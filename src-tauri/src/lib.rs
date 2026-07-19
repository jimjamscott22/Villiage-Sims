mod commands;
mod sim;
mod snapshot;

use std::sync::mpsc;

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
            let world = World::default_world();
            let terrain = world.terrain_snapshot();
            let catalog = world.catalog().clone();
            let (snapshot_tx, snapshot_rx) = watch::channel(world.tick_snapshot());
            let (command_tx, command_rx) = mpsc::channel();

            app.manage(AppState::new(terrain, catalog, command_tx));
            app.manage(start_simulation(world, snapshot_tx, command_rx));
            forward_snapshots(app.handle().clone(), snapshot_rx);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_terrain,
            commands::get_catalog,
            commands::set_viewport,
            commands::validate_placement,
            commands::place_building,
            commands::demolish,
            commands::move_villager_to,
            commands::get_villager_detail
        ])
        .build(tauri::generate_context!())
        .expect("failed to build VillageSim");

    app.run(|handle, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            handle.state::<SimRuntime>().stop();
        }
    });
}
