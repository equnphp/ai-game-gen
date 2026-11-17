// 不在Rust构建中重编C++核心；Android仅链接受控的同源产物目录。
fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("android") {
        let directory = std::env::var("GG_ANDROID_CORE_LIB_DIR")
            .expect("GG_ANDROID_CORE_LIB_DIR must point to the received NDK-r27d core artifacts");
        println!("cargo:rustc-link-search=native={directory}");
        println!("cargo:rustc-link-lib=dylib=ggcore");
    }
    tauri_build::build();
}
