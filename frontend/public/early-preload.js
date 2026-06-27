/* early-preload.js: 在 Vue 挂载前执行的预加载逻辑（站点配置/壁纸/Logo/图标/搜索引擎图标），从 index.html 抽出 */

    (function() {
      // ===== 1. 站点标题和 favicon 预注入 + Logo 预加载 =====
      try {
        var siteConfigRaw = localStorage.getItem('sun-panel-site-config');
        if (siteConfigRaw) {
          var siteConfig = JSON.parse(siteConfigRaw);
          if (siteConfig.site_title) {
            document.title = siteConfig.site_title;
          }
          if (siteConfig.favicon_url) {
            // 不再拼接 _t=Date.now() 时间戳：favicon 内容稳定，让浏览器走正常缓存
            var favUrl = siteConfig.favicon_url;

            var iconLink = document.createElement('link');
            iconLink.rel = 'icon';
            iconLink.href = favUrl;
            document.head.appendChild(iconLink);

            var appleLink = document.createElement('link');
            appleLink.rel = 'apple-touch-icon';
            appleLink.href = favUrl;
            document.head.appendChild(appleLink);
          }
          // Logo 预加载：首屏可见，高优先级
          if (siteConfig.logo_image_src) {
            var logoSrc = siteConfig.logo_image_src;
            var logoLink = document.createElement('link');
            logoLink.rel = 'preload';
            logoLink.as = 'image';
            logoLink.href = logoSrc;
            logoLink.setAttribute('data-logo-preload', 'true');
            logoLink.setAttribute('fetchpriority', 'high');
            document.head.appendChild(logoLink);

            try {
              var logoUrl = new URL(logoSrc);
              if (logoUrl.hostname !== location.hostname) {
                var logoPc = document.createElement('link');
                logoPc.rel = 'preconnect';
                logoPc.href = logoUrl.origin;
                logoPc.crossOrigin = 'anonymous';
                document.head.appendChild(logoPc);
              }
            } catch(e) {}
          }
        }
      } catch(e) {}

      // ===== 2. 壁纸预加载（高优先级，首屏视觉关键） =====
      var key = 'sun-panel-effective-wallpaper';
      var wallpaper = localStorage.getItem(key);
      if (wallpaper) {
        var link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = wallpaper;
        link.setAttribute('data-wallpaper', 'true');
        link.setAttribute('fetchpriority', 'high');
        document.head.appendChild(link);

        // 外部域名添加 preconnect，节省 TLS/连接时间
        try {
          var url = new URL(wallpaper);
          if (url.hostname !== location.hostname) {
            var pc = document.createElement('link');
            pc.rel = 'preconnect';
            pc.href = url.origin;
            pc.crossOrigin = 'anonymous';
            document.head.appendChild(pc);
          }
        } catch(e) {}
      }

      // ===== 3. 首屏图标预加载（基于 panelData 缓存，低优先级，与 Vue bundle 并行下载） =====
      try {
        var userRaw = localStorage.getItem('sun-panel-user');
        var userId = 'guest';
        if (userRaw) {
          try {
            var userObj = JSON.parse(userRaw);
            if (userObj && userObj.id != null) userId = String(userObj.id);
          } catch(e) {}
        }
        var panelDataRaw = localStorage.getItem('sun-panel:panel-data:' + userId);
        if (!panelDataRaw) {
          panelDataRaw = localStorage.getItem('sun-panel:panel-data:guest');
        }
        if (panelDataRaw) {
          var panelData = JSON.parse(panelDataRaw);
          var pData = panelData && panelData.data;
          if (pData && Array.isArray(pData.groups) && pData.itemsMap) {
            var preconnectOrigins = {};
            var iconCount = 0;
            var seenIcons = {};
            // 遍历前 2 个分组，每组前 6 个图标，最多收集 12 个唯一 src
            var maxGroups = Math.min(2, pData.groups.length);
            for (var gi = 0; gi < maxGroups && iconCount < 12; gi++) {
              var group = pData.groups[gi];
              if (!group || group.id == null) continue;
              var items = pData.itemsMap[group.id];
              if (!Array.isArray(items)) continue;
              var maxItems = Math.min(6, items.length);
              for (var ii = 0; ii < maxItems && iconCount < 12; ii++) {
                try {
                  var item = items[ii];
                  var src = item && item.icon && item.icon.src;
                  if (!src || seenIcons[src]) continue;
                  seenIcons[src] = true;

                  var iconLink = document.createElement('link');
                  iconLink.rel = 'preload';
                  iconLink.as = 'image';
                  iconLink.href = src;
                  iconLink.setAttribute('data-icon-preload', 'true');
                  iconLink.setAttribute('fetchpriority', 'low');
                  document.head.appendChild(iconLink);
                  iconCount++;

                  // 外部域额外注入去重的 preconnect
                  try {
                    var iconUrl = new URL(src);
                    if (iconUrl.hostname !== location.hostname && !preconnectOrigins[iconUrl.origin]) {
                      preconnectOrigins[iconUrl.origin] = true;
                      var iconPc = document.createElement('link');
                      iconPc.rel = 'preconnect';
                      iconPc.href = iconUrl.origin;
                      iconPc.crossOrigin = 'anonymous';
                      document.head.appendChild(iconPc);
                    }
                  } catch(e) {}
                } catch(e) {}
              }
            }

            // ===== 4. 默认搜索引擎图标预加载（高优先级，搜索框首屏可见） =====
            if (pData.searchEngine && Array.isArray(pData.searchEngine.engines) && pData.searchEngine.engines.length > 0) {
              var seIdx = pData.searchEngine.currentIndex;
              if (typeof seIdx !== 'number' || seIdx < 0 || seIdx >= pData.searchEngine.engines.length) {
                seIdx = 0;
              }
              var engineIcon = pData.searchEngine.engines[seIdx] && pData.searchEngine.engines[seIdx].icon;
              if (engineIcon) {
                var engineLink = document.createElement('link');
                engineLink.rel = 'preload';
                engineLink.as = 'image';
                engineLink.href = engineIcon;
                engineLink.setAttribute('data-engine-icon-preload', 'true');
                engineLink.setAttribute('fetchpriority', 'high');
                document.head.appendChild(engineLink);

                try {
                  var engineIconUrl = new URL(engineIcon);
                  if (engineIconUrl.hostname !== location.hostname && !preconnectOrigins[engineIconUrl.origin]) {
                    preconnectOrigins[engineIconUrl.origin] = true;
                    var enginePc = document.createElement('link');
                    enginePc.rel = 'preconnect';
                    enginePc.href = engineIconUrl.origin;
                    enginePc.crossOrigin = 'anonymous';
                    document.head.appendChild(enginePc);
                  }
                } catch(e) {}
              }
            }
          }
        }
      } catch(e) {}
    })();
