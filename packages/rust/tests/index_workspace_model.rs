use intenttext::{
    is_workspace, load_or_build_index, register_workspace, unregister_workspace,
};

fn make_temp_root() -> std::path::PathBuf {
    std::env::temp_dir().join(format!("intenttext-workspace-{}", uuid::Uuid::new_v4()))
}

#[test]
fn register_creates_single_root_index_with_recursive_data() {
    let root = make_temp_root();
    std::fs::create_dir_all(root.join("a/b")).expect("mkdir");
    std::fs::write(root.join("root.it"), "task: Root").expect("write root");
    std::fs::write(root.join("a/b/nested.it"), "task: Nested").expect("write nested");

    let info = register_workspace(&root).expect("register workspace");
    assert_eq!(info.collection_count, 2);
    assert!(root.join(".it-index").exists());
    assert!(!root.join("a").join(".it-index").exists());

    let db = load_or_build_index(&root).expect("load db");
    assert!(db.collections.contains_key("root"));
    assert!(db.collections.contains_key("a/b/nested"));

    std::fs::remove_dir_all(root).expect("cleanup");
}

#[test]
fn load_or_build_updates_for_new_and_deleted_files() {
    let root = make_temp_root();
    std::fs::create_dir_all(&root).expect("mkdir");
    std::fs::write(root.join("one.it"), "task: One").expect("write one");

    register_workspace(&root).expect("register workspace");

    std::fs::write(root.join("two.it"), "task: Two").expect("write two");
    let db = load_or_build_index(&root).expect("refresh index");
    assert!(db.collections.contains_key("two"));

    std::fs::remove_file(root.join("one.it")).expect("remove one");
    let db = load_or_build_index(&root).expect("refresh index after delete");
    assert!(!db.collections.contains_key("one"));

    std::fs::remove_dir_all(root).expect("cleanup");
}

#[test]
fn unregister_removes_only_index_file() {
    let root = make_temp_root();
    std::fs::create_dir_all(&root).expect("mkdir");
    std::fs::write(root.join("keep.it"), "note: Keep").expect("write file");

    register_workspace(&root).expect("register workspace");
    assert!(is_workspace(&root));

    unregister_workspace(&root).expect("unregister workspace");
    assert!(!root.join(".it-index").exists());
    assert!(root.join("keep.it").exists());

    std::fs::remove_dir_all(root).expect("cleanup");
}
