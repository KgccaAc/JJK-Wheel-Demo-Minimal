class_name BilibiliIdentityProvider
extends RefCounted

## 线上版应只调用自有后端。OAuth client secret、access token 和 refresh token
## 不属于 Godot 客户端，也不能写入本地登录卡存档。

func begin_registration() -> Dictionary:
	return {
		"ok": false,
		"code": "online_service_unavailable",
		"message": "Bilibili 认证服务尚未配置，请等待线上服务上线。"
	}

func poll_registration(_request_id: String) -> Dictionary:
	return {
		"ok": false,
		"code": "online_service_unavailable",
		"message": "Bilibili 认证服务尚未配置。"
	}

func refresh_profile(_card_id: String) -> Dictionary:
	return {
		"ok": false,
		"code": "online_service_unavailable",
		"message": "Bilibili 认证服务尚未配置。"
	}

