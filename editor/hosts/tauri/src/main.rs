// 桌面入口复用库入口；Android另按官方生成工程接入同一库。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main(){gamegen_editor_host::run();}
