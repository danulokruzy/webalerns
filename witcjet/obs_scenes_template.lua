-- OBS Сцены и Source Collections для импорта
-- Скопировать это в текстовый файл, переименовать в JSON и импортировать в OBS

-- Вариант 1: Импорт через OBS JSON
{
  "version": 27,
  "name": "TikTok Streams Scene Collection",
  "scene_order": [
    {
      "name": "Main Stream"
    },
    {
      "name": "Intermission"
    },
    {
      "name": "Donation Alert"
    },
    {
      "name": "Full Dashboard"
    }
  ],
  "sources": [],
  "groups": [],
  "transition_duration": 300,
  "connections": {}
}

-- Вариант 2: Lua скрипт для автоматического создания сцен
local obs = obslua
local server_url = "http://localhost:5000"

function create_main_stream_scene()
    local scene_src = obs.obs_source_create_private("scene", "Main Stream", nil)
    local scene = obs.obs_scene_from_source(scene_src)
    
    -- Добавить Progress виджет
    local browser_settings = obs.obs_data_create()
    obs.obs_data_set_string(browser_settings, "url", server_url .. "/prog")
    obs.obs_data_set_int(browser_settings, "width", 1920)
    obs.obs_data_set_int(browser_settings, "height", 1080)
    
    local browser = obs.obs_source_create_private("browser_source", "Progress", browser_settings)
    obs.obs_scene_add(scene, browser)
    
    obs.obs_data_release(browser_settings)
    obs.obs_source_release(scene_src)
end

function create_intermission_scene()
    local scene_src = obs.obs_source_create_private("scene", "Intermission", nil)
    local scene = obs.obs_scene_from_source(scene_src)
    
    -- Gauge на левой стороне
    local gauge_settings = obs.obs_data_create()
    obs.obs_data_set_string(gauge_settings, "url", server_url .. "/gauge")
    obs.obs_data_set_int(gauge_settings, "width", 600)
    obs.obs_data_set_int(gauge_settings, "height", 600)
    
    local gauge = obs.obs_source_create_private("browser_source", "Gauge", gauge_settings)
    local gauge_item = obs.obs_scene_add(scene, gauge)
    obs.obs_sceneitem_set_pos(gauge_item, {x = 100, y = 100})
    
    -- Chat на правой стороне
    local chat_settings = obs.obs_data_create()
    obs.obs_data_set_string(chat_settings, "url", server_url .. "/chat")
    obs.obs_data_set_int(chat_settings, "width", 400)
    obs.obs_data_set_int(chat_settings, "height", 600)
    
    local chat = obs.obs_source_create_private("browser_source", "Chat", chat_settings)
    local chat_item = obs.obs_scene_add(scene, chat)
    obs.obs_sceneitem_set_pos(chat_item, {x = 1420, y = 240})
    
    obs.obs_data_release(gauge_settings)
    obs.obs_data_release(chat_settings)
    obs.obs_source_release(scene_src)
end

function create_donation_alert_scene()
    local scene_src = obs.obs_source_create_private("scene", "Donation Alert", nil)
    local scene = obs.obs_scene_from_source(scene_src)
    
    -- Donation виджет
    local donation_settings = obs.obs_data_create()
    obs.obs_data_set_string(donation_settings, "url", server_url .. "/donation")
    obs.obs_data_set_int(donation_settings, "width", 1920)
    obs.obs_data_set_int(donation_settings, "height", 1080)
    
    local donation = obs.obs_source_create_private("browser_source", "Donation", donation_settings)
    obs.obs_scene_add(scene, donation)
    
    obs.obs_data_release(donation_settings)
    obs.obs_source_release(scene_src)
end

function create_dashboard_scene()
    local scene_src = obs.obs_source_create_private("scene", "Full Dashboard", nil)
    local scene = obs.obs_scene_from_source(scene_src)
    
    -- Progress (top)
    local prog_settings = obs.obs_data_create()
    obs.obs_data_set_string(prog_settings, "url", server_url .. "/prog")
    obs.obs_data_set_int(prog_settings, "width", 1920)
    obs.obs_data_set_int(prog_settings, "height", 270)
    
    local prog = obs.obs_source_create_private("browser_source", "Progress", prog_settings)
    local prog_item = obs.obs_scene_add(scene, prog)
    obs.obs_sceneitem_set_pos(prog_item, {x = 0, y = 0})
    obs.obs_sceneitem_set_bounds(prog_item, {x = 1920, y = 270})
    
    -- Gauge (bottom-left)
    local gauge_settings = obs.obs_data_create()
    obs.obs_data_set_string(gauge_settings, "url", server_url .. "/gauge")
    obs.obs_data_set_int(gauge_settings, "width", 600)
    obs.obs_data_set_int(gauge_settings, "height", 810)
    
    local gauge = obs.obs_source_create_private("browser_source", "Gauge", gauge_settings)
    local gauge_item = obs.obs_scene_add(scene, gauge)
    obs.obs_sceneitem_set_pos(gauge_item, {x = 0, y = 270})
    
    -- Chat (bottom-middle)
    local chat_settings = obs.obs_data_create()
    obs.obs_data_set_string(chat_settings, "url", server_url .. "/chat")
    obs.obs_data_set_int(chat_settings, "width", 660)
    obs.obs_data_set_int(chat_settings, "height": 810)
    
    local chat = obs.obs_source_create_private("browser_source", "Chat", chat_settings)
    local chat_item = obs.obs_scene_add(scene, chat)
    obs.obs_sceneitem_set_pos(chat_item, {x = 600, y = 270})
    
    -- Donation (bottom-right)
    local donation_settings = obs.obs_data_create()
    obs.obs_data_set_string(donation_settings, "url", server_url .. "/donation")
    obs.obs_data_set_int(donation_settings, "width", 660)
    obs.obs_data_set_int(donation_settings, "height", 810)
    
    local donation = obs.obs_source_create_private("browser_source", "Donation", donation_settings)
    local donation_item = obs.obs_scene_add(scene, donation)
    obs.obs_sceneitem_set_pos(donation_item, {x = 1260, y = 270})
    
    obs.obs_data_release(prog_settings)
    obs.obs_data_release(gauge_settings)
    obs.obs_data_release(chat_settings)
    obs.obs_data_release(donation_settings)
    obs.obs_source_release(scene_src)
end

function create_all_scenes()
    create_main_stream_scene()
    create_intermission_scene()
    create_donation_alert_scene()
    create_dashboard_scene()
    obs.script_log(obs.LOG_INFO, "All scenes created!")
end

function script_load(settings)
    create_all_scenes()
end
