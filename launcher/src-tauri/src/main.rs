// Evita abrir una consola adicional en Windows en compilaciones release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    dedsafio_launcher_lib::run()
}
