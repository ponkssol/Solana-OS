fn main() {
    println!("cargo::rustc-check-cfg=cfg(standalone_test)");
    tauri_build::build()
}
