use std::{
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
        mpsc,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use tokio::sync::watch;

use crate::snapshot::TickSnapshot;

use commands::SimCommand;
use world::World;

pub mod agents;
pub mod buildings;
pub mod catalog;
pub mod clock;
pub mod commands;
pub mod crops;
pub mod economy;
pub mod jobs;
pub mod needs;
pub mod nodes;
pub mod pathfind;
pub mod resources;
pub mod terrain;
pub mod utility;
pub mod world;

const TICK_INTERVAL: Duration = Duration::from_millis(50);

pub struct SimRuntime {
    stop: Arc<AtomicBool>,
    worker: Mutex<Option<JoinHandle<()>>>,
}

impl SimRuntime {
    pub fn stop(&self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(worker) = self.worker.lock().expect("sim worker lock poisoned").take() {
            let _ = worker.join();
        }
    }
}

impl Drop for SimRuntime {
    fn drop(&mut self) {
        self.stop();
    }
}

pub fn start_simulation(
    mut world: World,
    snapshots: watch::Sender<TickSnapshot>,
    commands: mpsc::Receiver<SimCommand>,
) -> SimRuntime {
    let stop = Arc::new(AtomicBool::new(false));
    let thread_stop = Arc::clone(&stop);
    let worker = thread::spawn(move || {
        while !thread_stop.load(Ordering::Relaxed) {
            while let Ok(command) = commands.try_recv() {
                world.handle_command(command);
            }
            let interval = world.clock().speed.tick_interval(TICK_INTERVAL);
            let deadline = Instant::now() + interval;
            if !world.clock().speed.is_paused() {
                world.advance();
            }
            // Always publish so paused plant/demolish commands reach the UI.
            snapshots.send_replace(world.tick_snapshot());
            if let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
                thread::sleep(remaining);
            }
        }
    });

    SimRuntime {
        stop,
        worker: Mutex::new(Some(worker)),
    }
}

#[cfg(test)]
mod tests {
    use std::{sync::mpsc, time::Duration};

    use tokio::sync::watch;

    use super::*;

    #[test]
    fn simulation_thread_publishes_a_later_tick() {
        let world = World::generate(4, 4, 32, 1);
        let initial = world.tick_snapshot();
        let (sender, receiver) = watch::channel(initial);
        let (_command_tx, command_rx) = mpsc::channel();
        let runtime = start_simulation(world, sender, command_rx);

        std::thread::sleep(Duration::from_millis(70));
        let observed = receiver.borrow().tick;
        runtime.stop();

        assert!(observed >= 1);
    }
}
