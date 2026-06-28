import { defineStore } from 'pinia'

export interface PanelState {
  panelConfig: Panel.panelConfig
}

const defaultPanelConfig: Panel.panelConfig = {
  backgroundImageSrc: '',
  backgroundBlur: 0,
  backgroundMaskNumber: 0.3,
  iconStyle: 'text' as Panel.PanelPanelConfigStyleEnum,
  iconTextColor: '#ffffff',
  iconTextInfoHideDescription: false,
  iconTextIconHideTitle: false,
  logoText: '',
  logoImageSrc: '',
  logoPositionTop: 16,
  logoPositionLeft: 16,
  logoSize: 48,
  clockShowSecond: true,
  clockColor: '#ffffff',
  searchBoxShow: true,
  searchBoxSearchIcon: true,
  marginTop: 40,
  marginBottom: 40,
  maxWidth: 1200,
  maxWidthUnit: 'px',
  marginX: 20,
  footerHtml: '',
  announcement: '',
  announcementDuration: 5,
  announcementBlur: 12,
  announcementMaskOpacity: 0.15,
  systemMonitorShow: false,
  systemMonitorShowTitle: true,
  systemMonitorPublicVisitModeShow: false,
  // ====== 随机一言 ======
  hitokotoShow: false,
  hitokotoApiUrl: 'https://v1.hitokoto.cn/',
  hitokotoCategories: [],
  hitokotoAlign: 'center',
  hitokotoTypewriter: false,
  hitokotoTypewriterDuration: 3,
  hitokotoTypewriterCursor: 'blink',
  hitokotoTypewriterAnimation: 'type',
  hitokotoShowFrom: true,
  hitokotoShowFromWho: true,
  hitokotoAutoSwitch: false,
  hitokotoAutoSwitchInterval: 30,
  hitokotoTransitionDuration: 0.3,
  // ====== 音乐播放 ======
  musicShow: false,
  musicServer: 'netease',
  musicType: 'playlist',
  musicId: '',
  musicApiUrl: 'https://api.moeyao.cn/meting/',
  musicAutoplay: false,
  musicVolume: 0.7,
  musicLoop: 'all',
  musicOrder: 'list',
}

export const usePanelState = defineStore('panel', {
  state: (): PanelState => ({
    panelConfig: { ...defaultPanelConfig },
  }),

  actions: {
    setPanelConfig(config: Panel.panelConfig) {
      this.panelConfig = { ...defaultPanelConfig, ...config }
    },

    updatePanelConfigFromCloud(config: Panel.panelConfig) {
      this.setPanelConfig(config)
    },
  },
})
