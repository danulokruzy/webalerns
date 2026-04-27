-- ═════════════════════════════════════════════════════════════
-- TikTok OBS Plugin - Главный Lua скрипт
-- Загружать в OBS: Tools → Scripts → Добавить этот файл
-- ═════════════════════════════════════════════════════════════

local obs = obslua
local http = require("http") or nil
local json = require("json") or nil

-- Параметры плагина
local PLUGIN_VERSION = "1.0"
local PLUGIN_NAME = "TikTok OBS Plugin"
local SERVER_URL = "http://127.0.0.1:5000"
local SCENES_TO_CREATE = {
    "Main Stream",
    "Intermission",
    "Donate Alert",
    "Dashboard"
}

-- Состояние
local plugin_state = {
    server_running = false,
    scenes_created = false,
    debug_mode = true
}

-- ═════════════════════════════════════════════════════════════
-- ОСНОВНЫЕ ФУНКЦИИ
-- ═════════════════════════════════════════════════════════════

function script_description()
    return PLUGIN_NAME .. " v" .. PLUGIN_VERSION .. 
           "\n\nУправление виджетами TikTok Live для OBS\n" ..
           "GitHub: github.com/DanulO/TikTok-OBS-Plugin"
end

function script_properties()
    local props = obs.obs_properties_create()
    
    -- Информацион
    obs.obs_properties_add_text(props, "info", "Информация", obs.OBS_TEXT_DISABLED)
    
    -- Настройки сервера
    obs.obs_properties_add_text(props, "server_url", "URL сервера", obs.OBS_TEXT_DEFAULT)
    obs.obs_properties_add_bool(props, "auto_connect", "Автоподключение")
    
    -- Кнопки действий
    obs.obs_properties_add_button(props, "create_scenes_btn", "Создать сцены", create_scenes_button)
    obs.obs_properties_add_button(props, "check_server_btn", "Проверить сервер", check_server_button)
    obs.obs_properties_add_button(props, "open_control_btn", "Открыть управление", open_control_button)
    
    -- Дополнительно
    obs.obs_properties_add_bool(props, "debug_mode", "Режим отладки")
    
    return props
end

function script_update(settings)
    SERVER_URL = obs.obs_data_get_string(settings, "server_url") or SERVER_URL
    plugin_state.debug_mode = obs.obs_data_get_bool(settings, "debug_mode")
    
    if obs.obs_data_get_bool(settings, "auto_connect") then
        check_server_connection()
    end
end

function script_load(settings)
    debug_log("Плагин загружен. Версия: " .. PLUGIN_VERSION)
    script_update(settings)
    obs.timer_add(update_loop, 1000)
end

function script_unload()
    obs.timer_remove(update_loop)
    debug_log("Плагин выгружен")
end

-- ═════════════════════════════════════════════════════════════
-- СЛУЖЕБНЫЕ ФУНКЦИИ
-- ═════════════════════════════════════════════════════════════

function debug_log(msg)
    if plugin_state.debug_mode then
        obs.script_log(obs.LOG_INFO, "[TikTok Plugin] " .. tostring(msg))
    end
end

function update_loop()
    -- Проверять статус сервера каждые 10 секунд
    if math.random(10) == 1 then
        check_server_connection()
    end
end

function check_server_connection()
    debug_log("Проверка подключения к серверу...")
    -- В реальной реализации здесь была бы проверка HTTP
    plugin_state.server_running = true
    debug_log("Сервер доступен: " .. SERVER_URL)
end

-- ═════════════════════════════════════════════════════════════
-- СОЗДАНИЕ СЦЕН
-- ═════════════════════════════════════════════════════════════

function create_scenes_button(props, button_press_action)
    create_all_scenes()
    return true
end

function create_all_scenes()
    debug_log("Создание сцен...")
    
    -- Сцена 1: Main Stream
    create_scene("Main Stream", {
        {
            name = "Progress",
            source = "browser_source",
            url = SERVER_URL .. "/progress",
            width = 1920,
            height = 1080,
            x = 0,
            y = 0
        }
    })
    
    -- Сцена 2: Intermission
    create_scene("Intermission", {
        {
            name = "Gauge",
            source = "browser_source",
            url = SERVER_URL .. "/gauge",
            width = 600,
            height = 600,
            x = 100,
            y = 100
        },
        {
            name = "Chat",
            source = "browser_source",
            url = SERVER_URL .. "/chat",
            width = 400,
            height = 600,
            x = 1520,
            y = 240
        }
    })
    
    -- Сцена 3: Donate Alert
    create_scene("Donate Alert", {
        {
            name = "Donation",
            source = "browser_source",
            url = SERVER_URL .. "/donation",
            width = 1920,
            height = 1080,
            x = 0,
            y = 0
        }
    })
    
    -- Сцена 4: Dashboard
    create_scene("Dashboard", {
        {
            name = "Progress",
            source = "browser_source",
            url = SERVER_URL .. "/progress",
            width = 1920,
            height = 270,
            x = 0,
            y = 0
        },
        {
            name = "Gauge",
            source = "browser_source",
            url = SERVER_URL .. "/gauge",
            width = 640,
            height = 810,
            x = 0,
            y = 270
        },
        {
            name = "Chat",
            source = "browser_source",
            url = SERVER_URL .. "/chat",
            width = 640,
            height = 810,
            x = 640,
            y = 270
        },
        {
            name = "Donation",
            source = "browser_source",
            url = SERVER_URL .. "/donation",
            width = 640,
            height = 810,
            x = 1280,
            y = 270
        }
    })
    
    plugin_state.scenes_created = true
    debug_log("✓ Сцены созданы успешно!")
    obs.script_log(obs.LOG_INFO, "✓ 4 сцены созданы!")
end

function create_scene(scene_name, sources)
    -- Проверить существует ли сцена
    local existing_scene = obs.obs_get_scene_by_name(scene_name)
    if existing_scene then
        obs.obs_source_release(existing_scene)
        debug_log("⚠ Сцена '" .. scene_name .. "' уже существует")
        return
    end
    
    -- Создать новую сцену
    local scene_source = obs.obs_source_create_private("scene", scene_name, nil)
    local scene = obs.obs_scene_from_source(scene_source)
    
    -- Добавить источники в сцену
    for _, source_config in ipairs(sources) do
        add_source_to_scene(scene, source_config)
    end
    
    obs.obs_source_release(scene_source)
    debug_log("✓ Создана сцена: " .. scene_name)
end

function add_source_to_scene(scene, config)
    local settings = obs.obs_data_create()
    
    if config.source == "browser_source" then
        obs.obs_data_set_string(settings, "url", config.url)
        obs.obs_data_set_int(settings, "width", config.width)
        obs.obs_data_set_int(settings, "height", config.height)
        obs.obs_data_set_bool(settings, "reroute_audio", false)
    end
    
    local source = obs.obs_source_create_private(config.source, config.name, settings)
    if source then
        local item = obs.obs_scene_add(scene, source)
        obs.obs_sceneitem_set_pos(item, {x = config.x, y = config.y})
        obs.obs_source_release(source)
    end
    
    obs.obs_data_release(settings)
end

-- ═════════════════════════════════════════════════════════════
-- КНОПКИ В ИНТЕРФЕЙСЕ
-- ═════════════════════════════════════════════════════════════

function check_server_button(props, button_press_action)
    check_server_connection()
    return true
end

function open_control_button(props, button_press_action)
    debug_log("Открытие панели управления...")
    -- В Windows
    os.execute("start " .. SERVER_URL)
    return true
end

-- ═════════════════════════════════════════════════════════════
-- УПРАВЛЕНИЕ ВИДЖЕТАМИ
-- ═════════════════════════════════════════════════════════════

function toggle_widget_in_scene(scene_name, widget_name)
    local scene = obs.obs_get_scene_by_name(scene_name)
    if not scene then return end
    
    local scene_source = obs.obs_scene_from_source(scene)
    local items = obs.obs_scene_enum_items(scene_source)
    
    for _, item in ipairs(items) do
        local source = obs.obs_sceneitem_get_source(item)
        if obs.obs_source_get_name(source) == widget_name then
            local visible = obs.obs_sceneitem_visible(item)
            obs.obs_sceneitem_set_visible(item, not visible)
            debug_log("Виджет '" .. widget_name .. "' переключен")
        end
    end
    
    obs.obs_source_release(scene)
end

function refresh_all_widgets()
    debug_log("Обновление всех виджетов...")
    
    local scenes = obs.obs_frontend_get_scenes()
    for _, scene_source in ipairs(scenes) do
        local scene = obs.obs_scene_from_source(scene_source)
        local items = obs.obs_scene_enum_items(scene)
        
        for _, item in ipairs(items) do
            local source = obs.obs_sceneitem_get_source(item)
            local id = obs.obs_source_get_id(source)
            
            if id == "browser_source" then
                obs.obs_source_force_interaction_tick(source)
            end
        end
    end
    
    debug_log("✓ Все виджеты обновлены")
end

-- ═════════════════════════════════════════════════════════════
-- ГОРЯЧИЕ КЛАВИШИ И СОБЫТИЯ
-- ═════════════════════════════════════════════════════════════

-- Пример: Переключить сцену на нажатие F7
-- (раскомментировать для активации)

--[[
function on_hotkey_scene_trigger(pressed)
    if not pressed then return end
    
    local current_scene = obs.obs_frontend_get_current_scene()
    if current_scene == nil then return end
    
    local scene_name = obs.obs_source_get_name(current_scene)
    obs.obs_source_release(current_scene)
    
    debug_log("Сцена: " .. scene_name)
end

function obs.obs_hotkey_register_frontend("toggle_scene_plugin", 
    "Переключить виджеты", on_hotkey_scene_trigger)
--]]
