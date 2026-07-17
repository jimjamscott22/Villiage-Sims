mod commands;
mod sim;
mod snapshot;

use commands::AppState;
use sim::{SimRuntime, start_simulation, world::World};
use snapshot::TickSnapshot;
use tauri::{Emitter, Manager};
use tokio::sync::watch;

fn forward_snapshots(app: tauri::AppHandle, mut snapshots: watch::Receiver<TickSnapshot>) {
    tauri::async_runtime::spawn(async move {
        while snapshots.changed().await.is_ok() {
            let snapshot = snapshots.borrow_and_update().clone();
            if let Err(error) = app.emit("tick", snapshot) {
                eprintln!("failed to emit tick snapshot: {error}");
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let world = World::checkerboard(32, 24, 32);
            let terrain = world.terrain_snapshot();
            let (sender, receiver) = watch::channel(world.tick_snapshot());

            app.manage(AppState::new(terrain));
            app.manage(start_simulation(world, sender));
            forward_snapshots(app.handle().clone(), receiver);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![commands::get_terrain])
        .build(tauri::generate_context!())
        .expect("failed to build VillageSim");

    app.run(|handle, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            handle.state::<SimRuntime>().stop();
        }
    });
}
