-- OBS Lua Script для управления кастомными виджетами
-- Автоматизирует переключение сцен, управление источниками и эффектами

local obs = obslua
local script_title = "TikTok Widgets Control"
local widgets_server = "http://localhost:5000"

-- Параметры скрипта
local settings = {
    server_url = widgets_server,
    auto_refresh = true,
    refresh_interval = 1000,
    debug_mode = true
}

function script_description()
    return "Управление TikTok виджетами в OBS Studio"
end

function script_properties()
    local props = obs.obs_properties_create()
    
    obs.obs_properties_add_text(props, "server_url", "URL сервера", obs.OBS_TEXT_DEFAULT)
    obs.obs_properties_add_bool(props, "auto_refresh", "Автообновление")
    obs.obs_properties_add_int(props, "refresh_interval", "Интервал обновления (мс)", 100, 5000, 100)
    obs.obs_properties_add_bool(props, "debug_mode", "Режим отладки")
    
    obs.obs_properties_add_button(props, "toggle_widgets", "Включить/отключить виджеты", toggle_widgets)
    obs.obs_properties_add_button(props, "refresh_widgets", "Обновить виджеты", refresh_widgets)
    obs.obs_properties_add_button(props, "list_widgets", "Список виджетов", list_widgets_btn)
    
    return props
end

function script_update(settings_data)
    settings.server_url = obs.obs_data_get_string(settings_data, "server_url")
    settings.auto_refresh = obs.obs_data_get_bool(settings_data, "auto_refresh")
    settings.refresh_interval = obs.obs_data_get_int(settings_data, "refresh_interval")
    settings.debug_mode = obs.obs_data_get_bool(settings_data, "debug_mode")
end

function script_load(settings_data)
    script_update(settings_data)
    obs.timer_add(update_widgets, settings.refresh_interval)
    debug_log("Script loaded")
end

function script_unload()
    obs.timer_remove(update_widgets)
    debug_log("Script unloaded")
end

function debug_log(msg)
    if settings.debug_mode then
        obs.script_log(obs.LOG_INFO, "[TikTok Widgets] " .. msg)
    end
end

function update_widgets()
    if not settings.auto_refresh then
        return
    end
    
    -- Получить текущую сцену
    local current_scene = obs.obs_frontend_get_current_scene()
    if current_scene == nil then
        return
    end
    
    local scene_name = obs.obs_source_get_name(current_scene)
    obs.obs_source_release(current_scene)
    
    debug_log("Current scene: " .. scene_name)
end

function toggle_widgets()
    local scene = obs.obs_frontend_get_current_scene()
    if scene == nil then
        obs.script_log(obs.LOG_WARNING, "No scene active")
        return
    end
    
    local scene_source = obs.obs_scene_from_source(scene)
    local items = obs.obs_scene_enum_items(scene_source)
    
    for _, item in ipairs(items) do
        local source = obs.obs_sceneitem_get_source(item)
        local source_name = obs.obs_source_get_name(source)
        
        if string.find(source_name, "widget") or string.find(source_name, "Widget") then
            local visible = obs.obs_sceneitem_visible(item)
            obs.obs_sceneitem_set_visible(item, not visible)
            debug_log("Toggled: " .. source_name .. " -> " .. tostring(not visible))
        end
    end
    
    obs.obs_source_release(scene)
end

function refresh_widgets()
    debug_log("Refreshing widgets...")
    -- Обновить все источники браузера
    local scenes_array = obs.obs_frontend_get_scenes()
    
    for _, scene in ipairs(scenes_array) do
        local scene_source = obs.obs_scene_from_source(scene)
        local items = obs.obs_scene_enum_items(scene_source)
        
        for _, item in ipairs(items) do
            local source = obs.obs_sceneitem_get_source(item)
            local source_id = obs.obs_source_get_id(source)
            
            if source_id == "browser_source" then
                obs.obs_source_force_interaction_tick(source)
                debug_log("Refreshed browser source")
            end
        end
    end
end

function list_widgets_btn()
    debug_log("=== Available Widgets ===")
    debug_log("- Progress Bar (/prog)")
    debug_log("- VIP Widget (/vip)")
    debug_log("Widget API: " .. settings.server_url .. "/api/widgets")
end

-- Создание сцены с виджетом
function create_widget_scene(scene_name, widget_route)
    -- Создать новую сцену
    local scene_source = obs.obs_source_create_private("scene", scene_name, nil)
    if scene_source == nil then
        obs.script_log(obs.LOG_ERROR, "Failed to create scene")
        return
    end
    
    local scene = obs.obs_scene_from_source(scene_source)
    
    -- Добавить браузер-источник
    local browser_settings = obs.obs_data_create()
    obs.obs_data_set_string(browser_settings, "url", settings.server_url .. widget_route)
    obs.obs_data_set_int(browser_settings, "width", 1920)
    obs.obs_data_set_int(browser_settings, "height", 1080)
    
    local browser_source = obs.obs_source_create_private("browser_source", widget_route, browser_settings)
    if browser_source ~= nil then
        local scene_item = obs.obs_scene_add(scene, browser_source)
        obs.obs_sceneitem_set_visible(scene_item, true)
        obs.obs_source_release(browser_source)
    end
    
    obs.obs_data_release(browser_settings)
    obs.obs_source_release(scene_source)
    
    debug_log("Created scene: " .. scene_name .. " with widget route: " .. widget_route)
end
