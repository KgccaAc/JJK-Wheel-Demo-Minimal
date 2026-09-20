class_name WebLocalFilePicker
extends RefCounted

## 浏览器安全边界：仅由用户手势触发系统文件选择器，文件字节只回传给
## Godot 的 user:// 虚拟存储。绝不请求、枚举或展示服务器文件系统。
static var _receiver: Callable
static var _js_callback: JavaScriptObject

static func request_png(receiver: Callable) -> bool:
	if not OS.has_feature("web"):
		return false
	_receiver = receiver
	_js_callback = JavaScriptBridge.create_callback(_on_file_selected)
	var window: JavaScriptObject = JavaScriptBridge.get_interface("window")
	if window == null:
		return false
	window.set("jjkPreviewLoginCardSelected", _js_callback)
	JavaScriptBridge.eval("""
		(() => {
			const input = document.createElement('input');
			input.type = 'file'; input.accept = 'image/png,.png'; input.style.display = 'none';
			input.addEventListener('change', () => {
				const file = input.files && input.files[0];
				if (!file) { input.remove(); return; }
				const reader = new FileReader();
				reader.onload = () => { window.jjkPreviewLoginCardSelected(String(reader.result).split(',')[1], file.name); input.remove(); };
				reader.readAsDataURL(file);
			});
			document.body.appendChild(input); input.click();
		})();
	""", true)
	return true

static func _on_file_selected(args: Array) -> void:
	if _receiver.is_null() or args.is_empty():
		return
	var bytes: PackedByteArray = Marshalls.base64_to_raw(str(args[0]))
	var filename: String = str(args[1]) if args.size() > 1 else "login-card.png"
	var receiver: Callable = _receiver
	_receiver = Callable()
	_js_callback = null
	receiver.call(bytes, filename)

