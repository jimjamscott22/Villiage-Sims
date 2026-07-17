use std::{
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use tokio::sync::watch;

use crate::snapshot::TickSnapshot;
use world::World;

pub mod terrain;
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

pub fn start_simulation(mut world: World, snapshots: watch::Sender<TickSnapshot>) -> SimRuntime {
    let stop = Arc::new(AtomicBool::new(false));
    let thread_stop = Arc::clone(&stop);
    let worker = thread::spawn(move || {
        while !thread_stop.load(Ordering::Relaxed) {
            let deadline = Instant::now() + TICK_INTERVAL;
            world.advance();
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
    use std::time::Duration;

    use tokio::sync::watch;

    use super::*;

    #[test]
    fn simulation_thread_publishes_a_later_tick() {
        let world = World::generate(4, 4, 32, 1);
        let initial = world.tick_snapshot();
        let (sender, receiver) = watch::channel(initial);
        let runtime = start_simulation(world, sender);

        std::thread::sleep(Duration::from_millis(70));
        let observed = receiver.borrow().tick;
        runtime.stop();

        assert!(observed >= 1);
    }
}
