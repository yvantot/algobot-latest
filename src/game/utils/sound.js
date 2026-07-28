import { k } from "../../lib/kaplay.js";

let clickAudio = null;
let menuMusicAudio = null;
let farmAmbianceAudio = null;
let globalSoundsInitialized = false;

let lastUISoundTime = 0;
const UI_SOUND_COOLDOWN_MS = 100; // Cooldown for UI click sound

// Audio Volume Categories (values from 0.0 to 1.0)
let audioVolumes = {
    master: 1.0,
    music: 0.3,
    ambiance: 0.1,
    sfx: 1.0,
};

function loadSavedVolumes() {
    if (typeof localStorage === "undefined") return;
    const savedMaster = localStorage.getItem("algobot_volume_master");
    const savedMusic = localStorage.getItem("algobot_volume_music");
    const savedAmbiance = localStorage.getItem("algobot_volume_ambiance");
    const savedSfx = localStorage.getItem("algobot_volume_sfx");

    if (savedMaster !== null) audioVolumes.master = parseFloat(savedMaster);
    if (savedMusic !== null) audioVolumes.music = parseFloat(savedMusic);
    if (savedAmbiance !== null) audioVolumes.ambiance = parseFloat(savedAmbiance);
    if (savedSfx !== null) audioVolumes.sfx = parseFloat(savedSfx);

    // Backward compatibility with old algobot_sound key ("on" / "off")
    const legacySound = localStorage.getItem("algobot_sound");
    if (legacySound === "off" && savedMaster === null) {
        audioVolumes.master = 0;
    }
}

loadSavedVolumes();

export function getAudioVolumes() {
    return { ...audioVolumes };
}

export function setCategoryVolume(category, value) {
    const val = Math.max(0, Math.min(1, parseFloat(value) || 0));
    audioVolumes[category] = val;

    if (typeof localStorage !== "undefined") {
        localStorage.setItem(`algobot_volume_${category}`, val);
        localStorage.setItem(
            "algobot_sound",
            audioVolumes.master > 0 ? "on" : "off"
        );
    }

    if (k) {
        if (typeof k.setVolume === "function") {
            k.setVolume(audioVolumes.master);
        } else if (typeof k.volume === "function") {
            k.volume(audioVolumes.master);
        }
    }

    updateActiveMusicVolumes();
}

/**
 * Legacy support for getSoundVolume
 */
export function getSoundVolume() {
    return audioVolumes.master;
}

/**
 * Legacy support for setSoundVolume
 */
export function setSoundVolume(val) {
    let num = 1;
    if (val === "off" || val === 0 || val === false) num = 0;
    else if (typeof val === "number") num = Math.max(0, Math.min(1, val));
    setCategoryVolume("master", num);
    return num;
}

function getEffectiveMusicVolume() {
    return audioVolumes.master * audioVolumes.music;
}

function getEffectiveAmbianceVolume() {
    return audioVolumes.master * audioVolumes.ambiance;
}

function getEffectiveSfxVolume() {
    return audioVolumes.master * audioVolumes.sfx;
}

function getMenuMusicAudio() {
    if (typeof window === "undefined") return null;
    if (!menuMusicAudio) {
        menuMusicAudio = new Audio("/music/music_start_menu.mp3");
        menuMusicAudio.loop = true;
    }
    return menuMusicAudio;
}

function getFarmAmbianceAudio() {
    if (typeof window === "undefined") return null;
    if (!farmAmbianceAudio) {
        farmAmbianceAudio = new Audio("/music/music_farm_ambiance.mp3");
        farmAmbianceAudio.loop = true;
    }
    return farmAmbianceAudio;
}

function updateActiveMusicVolumes() {
    if (menuMusicAudio) {
        menuMusicAudio.volume = getEffectiveMusicVolume();
    }
    if (farmAmbianceAudio) {
        farmAmbianceAudio.volume = getEffectiveAmbianceVolume();
    }
}

function safePlayAudio(audio) {
    if (!audio) return;
    const promise = audio.play();
    if (promise !== undefined) {
        promise.catch(() => {
            // Browser autoplay restriction handling: resume on user interaction
            const resume = () => {
                audio.play().catch(() => { });
                window.removeEventListener("click", resume);
                window.removeEventListener("pointerdown", resume);
                window.removeEventListener("keydown", resume);
            };
            window.addEventListener("click", resume);
            window.addEventListener("pointerdown", resume);
            window.addEventListener("keydown", resume);
        });
    }
}

/**
 * Starts looping Start Menu background music
 */
export function play_music_menu() {
    const farm = getFarmAmbianceAudio();
    if (farm) {
        farm.pause();
    }

    const menu = getMenuMusicAudio();
    if (menu) {
        menu.volume = getEffectiveMusicVolume();
        safePlayAudio(menu);
    }
}

/**
 * Starts looping Farm ambiance music
 */
export function play_music_farm() {
    const menu = getMenuMusicAudio();
    if (menu) {
        menu.pause();
    }

    const farm = getFarmAmbianceAudio();
    if (farm) {
        farm.volume = getEffectiveAmbianceVolume();
        safePlayAudio(farm);
    }
}

export function stop_all_music() {
    if (menuMusicAudio) menuMusicAudio.pause();
    if (farmAmbianceAudio) farmAmbianceAudio.pause();
}

/**
 * Plays a game sound effect via Kaplay if sfx volume > 0.
 */
export function play_sfx(sound_name, opts = {}) {
    const effVol = getEffectiveSfxVolume();
    if (effVol <= 0) return;

    if (k && typeof k.play === "function") {
        try {
            k.play(sound_name, { volume: effVol, ...opts });
            return;
        } catch (e) {
            // Sound might not be loaded in Kaplay yet
        }
    }
}

/**
 * Hover sound disabled per request.
 */
export function play_ui_hover() {
    // No-op
}

function getClickAudio() {
    if (typeof window === "undefined") return null;
    if (!clickAudio) {
        clickAudio = new Audio("/sounds/sound_ui_click.mp3");
    }
    return clickAudio;
}

/**
 * Plays UI click sound effect.
 */
export function play_ui_click() {
    const effVol = getEffectiveSfxVolume();
    if (effVol <= 0) return;

    function canPlayUISound() {
        const now = Date.now();
        if (now - lastUISoundTime < UI_SOUND_COOLDOWN_MS) {
            return false;
        }
        lastUISoundTime = now;
        return true;
    }

    if (!canPlayUISound()) return;

    if (k && typeof k.play === "function") {
        try {
            k.play("ui_click", {
                speed: 1.0,
                volume: effVol,
            });
            return;
        } catch (e) { }
    }
    const audio = getClickAudio();
    if (audio) {
        audio.currentTime = 0;
        audio.playbackRate = 1.0;
        audio.volume = effVol;
        audio.play().catch(() => { });
    }
}

/**
 * Automatically attaches click sound triggers to all buttons across the application.
 */
export function initGlobalUISounds() {
    if (typeof window === "undefined" || globalSoundsInitialized) return;
    globalSoundsInitialized = true;

    window.addEventListener(
        "click",
        (e) => {
            const btn = e.target.closest("button, [role='button']");
            if (btn && !btn.disabled) {
                play_ui_click();
            }
        },
        true
    );
}