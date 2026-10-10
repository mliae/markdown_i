/**
 * moments 多语言框架（P1：访客侧界面三语）
 *
 * 语言来源优先级（与服务端一致）：
 *   localStorage moments_lang（用户手动选择，最高优先）
 *   > window.__I18N_BOOT__.lang（SSR 首屏注入：cookie > 访问地 > 浏览器语言）
 *   > navigator.language 临时猜测
 *   > zh-CN
 *
 * 使用：
 *   t("key") / t("key", { name: "x" })      取词条（支持 {var} 插值）
 *   I18N.configure(settings)                 app.js 设置加载后同步配置
 *   I18N.setLang("en")                       手动切换（写 localStorage+cookie，重渲染）
 *   I18N.applyStatic(root)                   翻译带 data-i18n* 属性的静态节点
 *   I18N.on("change", fn)                    语言变更回调
 *   I18N.timeAgo(isoString)                  按当前语言格式化相对时间
 *
 * 词典可在本文件 DICT 内按命名空间持续扩展；词条缺失时依次回退 zh-CN、key 本身。
 */
(function () {
  "use strict";

  var SUPPORTED = ["zh-CN", "zh-TW", "en"];
  var STORAGE_KEY = "moments_lang";
  var COOKIE_KEY = "moments_lang";

  /* ====================== 词典 ====================== */
  var DICT = {
    "zh-CN": {
      // 通用
      "common.loading": "加载中…",
      "common.load_more": "加载更多",
      "common.retry": "重试",
      "common.confirm": "确定",
      "common.cancel": "取消",
      "common.close": "关闭",
      "common.save": "保存",
      "common.send": "发送",
      "common.submit": "提交",
      "common.reply": "回复",
      "common.delete": "删除",
      "common.edit": "编辑",
      "common.copy": "复制",
      "common.copied": "已复制",
      "common.link_copied": "链接已复制",
      "common.copy_failed": "复制失败",
      "common.back": "返回",
      "common.back_top": "返回顶部",
      "common.expand": "展开",
      "common.collapse": "收起",
      "common.all": "全部",
      "common.optional": "可选",
      "common.none": "暂无",
      "common.no_more": "没有更多了",
      "common.network_error": "网络错误，请稍后重试",
      "common.request_failed": "请求失败",
      "common.operation_failed": "操作失败",
      "common.confirm_action": "确定执行此操作吗？",
      "common.today": "今天",
      "common.yesterday": "昨天",
      "common.day": "天",
      "common.just_now": "刚刚",
      "common.min_ago": "{n} 分钟前",
      "common.hour_ago": "{n} 小时前",
      "common.day_ago": "{n} 天前",
      "common.month_ago": "{n} 个月前",
      "common.year_ago": "{n} 年前",
      "common.prev_page": "上一页",
      "common.page_info": "第 {page} / {pages} 页",
      "common.next_page": "下一页",
      "common.request_error_status": "请求失败 ({status})",
      "common.play_video": "播放视频",
      "common.image": "图片",
      "common.view_original": "点击查看原图",
      "common.original_badge": "原图",
      "common.uploading": "上传中...",
      "common.upload_failed": "上传失败",
      "common.footer_runtime": "网站已运行 {days} 天 {hh}:{mm}:{ss}",
      "common.open_menu": "打开菜单",
      "common.close_menu": "关闭菜单",
      "common.video_not_found": "当前页面没有视频",
      "common.retry_suffix": "{msg}，点击重试",
      "common.theme_light": "切换浅色模式",
      "common.theme_dark": "切换深色模式",

      // 导航 / 顶栏
      "nav.feed": "首页",
      "nav.posts": "文章",
      "nav.photos": "相册",
      "nav.links": "友链",
      "nav.friends": "友圈",
      "nav.about": "关于",
      "nav.admin": "后台",

      // 站内搜索
      "search.title": "站内搜索",
      "search.placeholder": "搜索文章、说说、友链…",
      "search.clear": "清除",
      "search.hint_select": "↑↓ 选择",
      "search.hint_open": "Enter 打开",
      "search.hint_close": "Esc 关闭",
      "search.empty": "没有找到相关内容",
      "search.loading": "搜索中…",
      "search.tab_all": "全部",
      "search.tab_posts": "文章",
      "search.tab_moments": "说说",
      "search.tab_friends": "友链",
      "search.result_count": "约 {n} 条结果",
      "search.input_hint": "输入关键词，搜索文章、说说、友链",
      "search.no_text": "（无文字）",
      "search.no_result": "没有找到与「{q}」相关的内容",
      "search.more": "查看更多「{name}」结果 →",
      "search.total": "共 {n} 条结果",
      "search.failed": "搜索失败",

      // 首页（说说时间线）
      "feed.empty": "还没有发布任何动态",
      "feed.pinned": "置顶",
      "feed.location": "于",
      "feed.expand_full": "展开全文",
      "feed.collapse": "收起",
      "feed.like": "赞",
      "feed.comment": "评论",
      "feed.liked": "已赞",
      "feed.load_older": "查看更多动态",
      "feed.publish": "发布说说",
      "feed.ago_at": "{time} · {loc}",
      "feed.confirm_delete": "确定删除这条说说吗？删除后不可恢复。",
      "feed.deleted": "已删除",
      "feed.delete_failed": "删除失败",
      "feed.like_failed": "操作失败，请稍后再试",
      "feed.unlike": "取消点赞",
      "feed.loading_more": "正在加载更多即刻...",
      "feed.scroll_more": "下滑继续浏览更多即刻",
      "feed.reached_end": "— 已经到底啦 —",
      "feed.search_title": "搜索「{q}」 · {site}",
      "feed.filter_only": "🔍 只显示包含「{q}」的说说",
      "feed.clear_filter": "清除筛选",
      "feed.read_full": "阅读全文 →",
      "feed.moment_hash": "即刻 #{id}",

      // 站外视频提示
      "video.yt_blocked": "此视频来自 YouTube，当前网络可能无法访问，请科学上网后观看",
      "video.open_youtube": "在 YouTube 打开 ↗",
      "video.load_failed": "视频加载失败，源站可能临时不可用或网络波动",
      "video.retry": "点击重试",

      // 文章
      "posts.title": "文章",
      "posts.empty": "还没有发布文章",
      "posts.continue": "继续阅读",
      "posts.toc": "目录",
      "posts.toc_open": "文章目录",
      "posts.prev": "上一篇",
      "posts.next": "下一篇",
      "posts.related": "相关推荐",
      "posts.published_at": "发布于",
      "posts.updated_at": "更新于",
      "posts.words": "{n} 字",
      "posts.reading_time": "约 {n} 分钟",
      "posts.views": "{n} 阅读",
      "posts.back_list": "返回文章列表",
      "posts.untitled": "无标题",
      "posts.tag": "文章",
      "posts.total": "共 {n} 篇文章",
      "posts.reward_default": "如果觉得这篇文章不错，欢迎打赏支持一下 ~",
      "posts.reward_qr_alt": "打赏二维码",
      "posts.toc_empty_heading": "标题",
      "posts.toc_collapse": "折叠目录",
      "posts.toc_close": "关闭目录",
      "posts.back_home": "返回首页",
      "posts.back_list_short": "返回列表",

      // 相册
      "photos.title": "相册",
      "photos.empty": "还没有照片",
      "photos.count": "{n} 张照片",
      "photos.total": "共 {n} 张图片",
      "photos.page_desc": "共 {n} 张图片 · 记录每一个精彩瞬间",
      "photos.empty_hint": "相册还没有图片",
      "photos.empty_tip": "在后台「相册管理」上传或从说说/文章同步",

      // 友链
      "links.title": "友情链接",
      "links.apply": "申请友链",
      "links.empty": "暂时没有友链",
      "links.visit": "去逛逛",
      "links.category_all": "全部",
      "links.apply_intro": "欢迎交换友链，请按下面格式留言或提交申请",
      "links.apply_site_name": "站点名称",
      "links.apply_site_url": "站点地址",
      "links.apply_avatar": "头像地址",
      "links.apply_desc": "站点描述",
      "links.apply_email": "联系邮箱",
      "links.apply_submit": "提交申请",
      "links.apply_success": "申请已提交，等待审核",
      "links.no_desc": "这个人很懒，什么都没留下。",
      "feed.moment_tag": "说说",
      "links.last_post_today": "今天更新",
      "links.last_post_yesterday": "昨天更新",
      "links.last_post_days": "{n} 天前更新",
      "links.last_post_stale": "超过 1 个月未更新",
      "links.not_subscribed": "未接入友圈",
      "links.fetch_error": "抓取异常",
      "links.fetch_pending": "等待抓取",
      "links.empty_apply_tip": '还没有友链，去<a href="/links/apply">申请友链</a>吧～',
      "links.eyebrow": "友链 · FRIENDS",
      "links.subtitle": "这里收集了我常去翻阅的独立博客与友站。每一家都有自己的节奏，值得慢下来读一读。",
      "links.stat_total": "友站总数",
      "links.stat_categories": "站点分类",
      "links.stat_new": "本月新增",
      "links.apply_banner_title": "想让你的站点也出现在这里？",
      "links.apply_banner_desc": "交换友链只需提交站点信息，或直接发邮件给我。通常 48 小时内回复，通过后就会加入这面友链墙。",
      "links.apply_eyebrow": "交换友链 · APPLY",
      "links.apply_subtitle": "如果你也在写博客，欢迎交换友链。请先确认自己的站点符合下面的规则，再填写信息提交申请。",
      "links.rules_title": "友链规则",
      "links.rules_intro": "为了保证友链墙的阅读感，这里只收录内容原创、长期更新的个人站点。",
      "links.rules_1": "内容以原创为主，无违规、采集与广告信息",
      "links.rules_2": "站点已稳定运行 6 个月以上，并有持续更新",
      "links.rules_3": "站点首页已放置本站链接，且可以正常访问",
      "links.rules_4": "无强制跳转、弹窗与其他干扰性广告",
      "links.rules_5": "站点方向与阅读、摄影、设计或技术相关",
      "links.site_info_title": "本站信息",
      "links.site_info_desc": "复制以下信息，填写到你的友链页面即可。",
      "links.apply_site_brief": "站点简介",
      "links.apply_form_title": "提交申请",
      "links.apply_form_tip": "填写后我会尽快查看，通过后站点会自动加入友链墙。",
      "links.apply_name_ph": "例：云间随笔",
      "links.fetch_auto": "自动获取",
      "links.apply_desc_ph": "一句话介绍你的站点",
      "links.apply_category": "站点分类",
      "links.apply_feed_url": "订阅地址",
      "links.apply_feed_ph": "https://example.com/feed.xml（选填）",
      "links.apply_feed_hint": "填入后通过审核自动纳入友圈抓取；也可留空由站长后续手动配置",
      "links.review_title": "审核流程",
      "links.review_1_title": "已提交申请",
      "links.review_1_desc": "表单提交成功",
      "links.review_2_title": "人工审核",
      "links.review_2_desc": "通常 48 小时内回复，结果会发到你的邮箱",
      "links.review_3_title": "上线展示",
      "links.review_3_desc": "通过后自动加入友链墙",
      "links.apply_status_title": "申请状态",
      "links.apply_status_sub": "所有友链申请的审核进度",
      "links.tab_all": "全部",
      "links.tab_pending": "待审核",
      "links.tab_approved": "已通过",
      "links.tab_rejected": "未通过",
      "links.no_pending": "暂无待审核申请",
      "links.no_approved": "暂无已通过申请",
      "links.no_rejected": "暂无未通过申请",
      "links.no_records": "暂无申请记录",
      "links.status_pending": "待审核",
      "links.status_approved": "已通过",
      "links.status_rejected": "未通过",
      "links.time_today": "今天",
      "links.time_yesterday": "昨天",
      "links.fill_url_first": "请先填写站点地址",
      "links.fetching": "获取中…",
      "links.fetch_auto_ok": "已自动获取站点信息，可再微调",
      "links.fetch_auto_fail": "获取失败，请手动填写",
      "links.apply_toast": "已提交申请，站长审核通过后会出现在友链列表",
      "links.submit_failed": "提交失败",
      "links.apply_seo_desc": "提交站点信息，申请加入友链墙。",

      // 关于页
      "about.stats_title": "一些数字",
      "about.timeline_title": "时间线",
      "about.contacts_title": "联系方式",
      "about.sponsor_title": "支持一下",
      "about.sponsor_action": "打赏支持",
      "about.greeting_default": "关于我",
      "about.bio_title": "自我介绍",
      "about.timeline_heading": "一路走来的几个坐标",
      "about.recent_title": "最近写的一些东西",
      "about.view_all": "查看全部",
      "about.bigstats_title": "这段时间，有多少人来过。",
      "about.contact_heading": "想聊点什么，就挂挂我。",
      "about.qr_alt": "赞助收款码",
      "about.coffee_title": "请我喝杯咖啡",
      "about.select_amount": "选择赞助金额",
      "about.scan_tip": "扫码支持，感谢你 ❤",

      // 评论
      "comment.title": "评论",
      "comment.count": "{n} 条评论",
      "comment.placeholder": "说点什么…",
      "comment.submit": "发表评论",
      "comment.reply_to": "回复 {name}",
      "comment.cancel_reply": "取消回复",
      "comment.view_more": "查看全部 {n} 条评论",
      "comment.hide": "收起评论",
      "comment.no_comments": "还没有评论，来说两句吧～",
      "comment.deleted": "该评论已删除",
      "comment.pending": "评论审核中",
      "comment.confirm_delete": "确定删除这条评论吗？",
      "comment.owo": "表情",
      "comment.image": "图片",
      "comment.at": "回复",
      "comment.emoji_panel": "表情",
      "comment.reply_success": "评论成功",
      "comment.reply_failed": "评论失败，请稍后再试",
      "comment.empty_tip": "评论内容不能为空",
      "comment.too_fast": "评论太快了，歇一会儿再试",
      "comment.subscribed": "有回复时邮件通知我",
      "comment.nickname": "昵称",
      "comment.email": "邮箱",
      "comment.website": "网站",
      "comment.guest": "访客",
      "comment.input_login_hint": "解锁后可使用管理员身份评论",
      "comment.feed_hint": "点击即刻卡片右下角的评论图标，可针对该条即刻发表评论",
      "comment.image_max": "最多 {n} 张图片",
      "comment.image_size_limit": "图片不能超过 {size}",
      "comment.upload_image": "上传图片",
      "comment.image_url_ph": "图片 URL，回车添加",
      "comment.random_one": "随机一句",
      "comment.notify_mine": "有人回复我的评论时邮件通知我",
      "comment.image_url_invalid": "请输入完整的图片 URL",
      "comment.owner_badge": "博主",
      "comment.expand_replies": "展开全部 {n} 条回复",
      "comment.collapse_replies": "收起回复",
      "comment.expand_more": "展开更多评论（剩余 {n} 条）",
      "comment.empty_first": "还没有评论，来说第一句吧",
      "comment.reply_giving": "回复给",
      "comment.ai_hint": "评论中 @{name} 可召唤 AI 回复",
      "comment.qq_no_nick": "未获取到昵称，请手动填写",
      "comment.nick_or_qq_ph": "昵称或 QQ 号（填 QQ 号自动获取昵称邮箱头像）",
      "comment.email_ph": "邮箱 *",
      "comment.website_ph": "网址（选填，头像可点击跳转）",
      "comment.placeholder_mention": "说点什么…（支持 @ 提及他人）",
      "comment.cancel_locate": "取消定位",
      "comment.select_target_first": "请先选择评论对象",
      "comment.nickname_required": "请填写昵称",
      "comment.email_required": "请填写邮箱",
      "comment.ai_called": "已召唤 {name}，回复稍后自动出现",

      // 音乐播放器
      "music.not_playing": "未播放",
      "music.click_play": "点击播放",
      "music.playlist": "播放列表",
      "music.close_list": "关闭",
      "music.prev": "上一首",
      "music.next": "下一首",
      "music.play_pause": "播放/暂停",
      "music.mode": "播放模式",
      "music.mode_list": "列表循环",
      "music.mode_random": "随机播放",
      "music.mode_one": "单曲循环",
      "music.playlist_btn": "播放列表",
      "music.lyric": "歌词",
      "music.mute": "静音",
      "music.volume": "音量",
      "music.collapse": "收起",
      "music.cover": "封面",
      "music.no_lyric": "暂无歌词",
      "music.resolving": "正在解析试听地址…",
      "music.resolve_ok": "解析成功，开始播放",
      "music.resolve_fail": "试听解析失败",
      "music.importing": "正在入库，请勿关闭…",
      "music.play_fail": "播放失败，请换一首试试",
      "music.loading": "加载音乐…",
      "music.playlist_empty": "歌单为空",
      "music.song_n": "歌曲 {n}",
      "music.song_fallback": "歌曲",
      "music.unknown_artist": "未知歌手",
      "music.unknown_song": "未知歌曲",
      "music.no_source_stop": "连续多首歌曲无可用音源，已停止播放",
      "music.no_source_next": "「{name}」暂无可用音源，自动下一首",
      "music.load_failed": "音乐加载失败",
      "music.mode_title": "播放模式：{mode}（点击切换）",
      "music.mode_toast": "播放模式：{mode}",
      "music.muted_autoplay_tip": "已静音自动播放，点击页面任意处开启声音",
      "music.play_failed": "播放失败",
      "music.play_fail_retry": "播放失败，请重试",
      "music.lyric_loading": "加载歌词中…",
      "music.lyric_failed": "歌词加载失败",
      "music.unavailable": "音乐不可用（已下架或版权限制）",
      "music.resolve_no_source": "试听地址解析失败，可能暂无音源",
      "music.resolve_success": "试听地址解析成功",

      // 404
      "404.title": "页面走丢了",
      "404.desc": "你访问的页面不存在或已被移除。",
      "404.back_home": "返回首页",

      // 灯箱
      "lightbox.download": "下载图片",
      "lightbox.before": "上一张",
      "lightbox.next": "下一张",
      "lightbox.load_failed": "图片查看器加载失败",

      // 语言切换器
      "lang.switch": "切换语言",
      "lang.lang_name": "简体中文",

      // 内容翻译按钮
      "translate.btn_en": "译为英文",
      "translate.btn_zh_tw": "译为繁体中文",
      "translate.loading": "翻译中…",
      "translate.note_ai": "本文由 AI 自动翻译，仅供参考",
      "translate.note_local": "本文已转换为繁体中文",
      "translate.view_original": "查看原文",
      "translate.view_translation": "查看译文",
      "translate.error": "翻译失败，请稍后重试",
      "translate.title": "翻译",
    },

    "zh-TW": {
      "common.loading": "載入中…",
      "common.load_more": "載入更多",
      "common.retry": "重試",
      "common.confirm": "確定",
      "common.cancel": "取消",
      "common.close": "關閉",
      "common.save": "儲存",
      "common.send": "送出",
      "common.submit": "送出",
      "common.reply": "回覆",
      "common.delete": "刪除",
      "common.edit": "編輯",
      "common.copy": "複製",
      "common.copied": "已複製",
      "common.link_copied": "連結已複製",
      "common.copy_failed": "複製失敗",
      "common.back": "返回",
      "common.back_top": "回到頂部",
      "common.expand": "展開",
      "common.collapse": "收合",
      "common.all": "全部",
      "common.optional": "選填",
      "common.none": "暫無",
      "common.no_more": "沒有更多了",
      "common.network_error": "網路錯誤，請稍後重試",
      "common.request_failed": "請求失敗",
      "common.operation_failed": "操作失敗",
      "common.confirm_action": "確定執行此操作嗎？",
      "common.today": "今天",
      "common.yesterday": "昨天",
      "common.day": "天",
      "common.just_now": "剛剛",
      "common.min_ago": "{n} 分鐘前",
      "common.hour_ago": "{n} 小時前",
      "common.day_ago": "{n} 天前",
      "common.month_ago": "{n} 個月前",
      "common.year_ago": "{n} 年前",
      "common.prev_page": "上一頁",
      "common.page_info": "第 {page} / {pages} 頁",
      "common.next_page": "下一頁",
      "common.request_error_status": "請求失敗 ({status})",
      "common.play_video": "播放影片",
      "common.image": "圖片",
      "common.view_original": "點擊查看原圖",
      "common.original_badge": "原圖",
      "common.uploading": "上傳中...",
      "common.upload_failed": "上傳失敗",
      "common.footer_runtime": "網站已運行 {days} 天 {hh}:{mm}:{ss}",
      "common.open_menu": "開啟選單",
      "common.close_menu": "關閉選單",
      "common.video_not_found": "目前頁面沒有影片",
      "common.retry_suffix": "{msg}，點擊重試",
      "common.theme_light": "切換淺色模式",
      "common.theme_dark": "切換深色模式",

      "nav.feed": "首頁",
      "nav.posts": "文章",
      "nav.photos": "相簿",
      "nav.links": "友鏈",
      "nav.friends": "友圈",
      "nav.about": "關於",
      "nav.admin": "後台",

      "search.title": "站內搜尋",
      "search.placeholder": "搜尋文章、動態、友鏈…",
      "search.clear": "清除",
      "search.hint_select": "↑↓ 選擇",
      "search.hint_open": "Enter 開啟",
      "search.hint_close": "Esc 關閉",
      "search.empty": "沒有找到相關內容",
      "search.loading": "搜尋中…",
      "search.tab_all": "全部",
      "search.tab_posts": "文章",
      "search.tab_moments": "動態",
      "search.tab_friends": "友鏈",
      "search.result_count": "約 {n} 筆結果",
      "search.input_hint": "輸入關鍵字，搜尋文章、動態、友鏈",
      "search.no_text": "（無文字）",
      "search.no_result": "沒有找到與「{q}」相關的內容",
      "search.more": "查看更多「{name}」結果 →",
      "search.total": "共 {n} 筆結果",
      "search.failed": "搜尋失敗",

      "feed.empty": "還沒有發布任何動態",
      "feed.pinned": "置頂",
      "feed.location": "於",
      "feed.expand_full": "展開全文",
      "feed.collapse": "收合",
      "feed.like": "讚",
      "feed.comment": "留言",
      "feed.liked": "已讚",
      "feed.load_older": "查看更多動態",
      "feed.publish": "發布動態",
      "feed.ago_at": "{time} · {loc}",
      "feed.confirm_delete": "確定刪除這條動態嗎？刪除後無法復原。",
      "feed.deleted": "已刪除",
      "feed.delete_failed": "刪除失敗",
      "feed.like_failed": "操作失敗，請稍後再試",
      "feed.unlike": "取消按讚",
      "feed.loading_more": "正在載入更多動態...",
      "feed.scroll_more": "下滑繼續瀏覽更多動態",
      "feed.reached_end": "— 已經到底囉 —",
      "feed.search_title": "搜尋「{q}」 · {site}",
      "feed.filter_only": "🔍 只顯示包含「{q}」的動態",
      "feed.clear_filter": "清除篩選",
      "feed.read_full": "閱讀全文 →",
      "feed.moment_hash": "動態 #{id}",

      // 站外影片提示
      "video.yt_blocked": "此影片來自 YouTube，目前網路可能無法連線，請檢查網路環境後觀看",
      "video.open_youtube": "在 YouTube 開啟 ↗",
      "video.load_failed": "影片載入失敗，源站可能暫時無法使用或網路波動",
      "video.retry": "點擊重試",

      "posts.title": "文章",
      "posts.empty": "還沒有發布文章",
      "posts.continue": "繼續閱讀",
      "posts.toc": "目錄",
      "posts.toc_open": "文章目錄",
      "posts.prev": "上一篇",
      "posts.next": "下一篇",
      "posts.related": "相關推薦",
      "posts.published_at": "發布於",
      "posts.updated_at": "更新於",
      "posts.words": "{n} 字",
      "posts.reading_time": "約 {n} 分鐘",
      "posts.views": "{n} 次閱讀",
      "posts.back_list": "返回文章列表",
      "posts.untitled": "無標題",
      "posts.tag": "文章",
      "posts.total": "共 {n} 篇文章",
      "posts.reward_default": "如果覺得這篇文章不錯，歡迎贊助支持一下～",
      "posts.reward_qr_alt": "贊助 QR Code",
      "posts.toc_empty_heading": "標題",
      "posts.toc_collapse": "摺疊目錄",
      "posts.toc_close": "關閉目錄",
      "posts.back_home": "返回首頁",
      "posts.back_list_short": "返回列表",

      "photos.title": "相簿",
      "photos.empty": "還沒有照片",
      "photos.count": "{n} 張照片",
      "photos.total": "共 {n} 張圖片",
      "photos.page_desc": "共 {n} 張圖片 · 記錄每一個精彩時刻",
      "photos.empty_hint": "相簿還沒有圖片",
      "photos.empty_tip": "請於後台「相簿管理」上傳，或從動態/文章同步",

      "links.title": "友情連結",
      "links.apply": "申請友鏈",
      "links.empty": "暫時沒有友鏈",
      "links.visit": "去逛逛",
      "links.category_all": "全部",
      "links.apply_intro": "歡迎交換友鏈，請依下方格式留言或送出申請",
      "links.apply_site_name": "網站名稱",
      "links.apply_site_url": "網站位址",
      "links.apply_avatar": "頭像位址",
      "links.apply_desc": "網站描述",
      "links.apply_email": "聯絡信箱",
      "links.apply_submit": "送出申請",
      "links.apply_success": "申請已送出，等待審核",
      "links.no_desc": "這個人很懶，什麼都沒留下。",
      "feed.moment_tag": "說說",
      "links.last_post_today": "今天更新",
      "links.last_post_yesterday": "昨天更新",
      "links.last_post_days": "{n} 天前更新",
      "links.last_post_stale": "超過 1 個月未更新",
      "links.not_subscribed": "未接入友圈",
      "links.fetch_error": "抓取異常",
      "links.fetch_pending": "等待抓取",
      "links.empty_apply_tip": '還沒有友鏈，去<a href="/links/apply">申請友鏈</a>吧～',
      "links.eyebrow": "友鏈 · FRIENDS",
      "links.subtitle": "這裡收集了我常去翻閱的獨立部落格與友站。每一家都有自己的步調，值得停下來慢慢讀。",
      "links.stat_total": "友站總數",
      "links.stat_categories": "網站分類",
      "links.stat_new": "本月新增",
      "links.apply_banner_title": "想讓你的網站也出現在這裡？",
      "links.apply_banner_desc": "交換友鏈只需送出網站資訊，或直接寄電子郵件給我。通常 48 小時內回覆，通過後就會加入這面友鏈牆。",
      "links.apply_eyebrow": "交換友鏈 · APPLY",
      "links.apply_subtitle": "如果你也在寫部落格，歡迎交換友鏈。請先確認自己的網站符合下方規則，再填寫資訊送出申請。",
      "links.rules_title": "友鏈規則",
      "links.rules_intro": "為了維持友鏈牆的閱讀品質，這裡只收錄內容原創、長期更新的個人網站。",
      "links.rules_1": "內容以原創為主，無違規、爬取與廣告資訊",
      "links.rules_2": "網站已穩定運行 6 個月以上，並持續更新",
      "links.rules_3": "網站首頁已放置本站連結，且可正常存取",
      "links.rules_4": "無強制跳轉、彈窗與其他干擾性廣告",
      "links.rules_5": "網站方向與閱讀、攝影、設計或技術相關",
      "links.site_info_title": "本站資訊",
      "links.site_info_desc": "複製以下資訊，貼到你的友鏈頁面即可。",
      "links.apply_site_brief": "網站簡介",
      "links.apply_form_title": "送出申請",
      "links.apply_form_tip": "填寫後我會儘快查看，通過後網站會自動加入友鏈牆。",
      "links.apply_name_ph": "例：雲間隨筆",
      "links.fetch_auto": "自動取得",
      "links.apply_desc_ph": "一句話介紹你的網站",
      "links.apply_category": "網站分類",
      "links.apply_feed_url": "訂閱地址",
      "links.apply_feed_ph": "https://example.com/feed.xml（選填）",
      "links.apply_feed_hint": "填入後通過審核自動納入友圈抓取；也可留空由站長後續手動配置",
      "links.review_title": "審核流程",
      "links.review_1_title": "已送出申請",
      "links.review_1_desc": "表單送出成功",
      "links.review_2_title": "人工審核",
      "links.review_2_desc": "通常 48 小時內回覆，結果會寄到你的信箱",
      "links.review_3_title": "上線展示",
      "links.review_3_desc": "通過後自動加入友鏈牆",
      "links.apply_status_title": "申請狀態",
      "links.apply_status_sub": "所有友鏈申請的審核進度",
      "links.tab_all": "全部",
      "links.tab_pending": "待審核",
      "links.tab_approved": "已通過",
      "links.tab_rejected": "未通過",
      "links.no_pending": "暫無待審核申請",
      "links.no_approved": "暫無已通過申請",
      "links.no_rejected": "暫無未通過申請",
      "links.no_records": "暫無申請記錄",
      "links.status_pending": "待審核",
      "links.status_approved": "已通過",
      "links.status_rejected": "未通過",
      "links.time_today": "今天",
      "links.time_yesterday": "昨天",
      "links.fill_url_first": "請先填寫網站位址",
      "links.fetching": "取得中…",
      "links.fetch_auto_ok": "已自動取得網站資訊，可再微調",
      "links.fetch_auto_fail": "取得失敗，請手動填寫",
      "links.apply_toast": "已送出申請，站長審核通過後會出現在友鏈列表",
      "links.submit_failed": "送出失敗",
      "links.apply_seo_desc": "送出網站資訊，申請加入友鏈牆。",

      "about.stats_title": "一些數字",
      "about.timeline_title": "時間軸",
      "about.contacts_title": "聯絡方式",
      "about.sponsor_title": "支持一下",
      "about.sponsor_action": "贊助支持",
      "about.greeting_default": "關於我",
      "about.bio_title": "自我介紹",
      "about.timeline_heading": "一路走來的幾個座標",
      "about.recent_title": "最近寫的一些東西",
      "about.view_all": "查看全部",
      "about.bigstats_title": "這段時間，有多少人來過。",
      "about.contact_heading": "想聊點什麼，隨時找我。",
      "about.qr_alt": "贊助收款碼",
      "about.coffee_title": "請我喝杯咖啡",
      "about.select_amount": "選擇贊助金額",
      "about.scan_tip": "掃碼支持，感謝你 ❤",

      "comment.title": "留言",
      "comment.count": "{n} 則留言",
      "comment.placeholder": "說點什麼…",
      "comment.submit": "發表留言",
      "comment.reply_to": "回覆 {name}",
      "comment.cancel_reply": "取消回覆",
      "comment.view_more": "查看全部 {n} 則留言",
      "comment.hide": "收合留言",
      "comment.no_comments": "還沒有留言，來說兩句吧～",
      "comment.deleted": "此留言已刪除",
      "comment.pending": "留言審核中",
      "comment.confirm_delete": "確定刪除這則留言嗎？",
      "comment.owo": "表情",
      "comment.image": "圖片",
      "comment.at": "回覆",
      "comment.emoji_panel": "表情",
      "comment.reply_success": "留言成功",
      "comment.reply_failed": "留言失敗，請稍後再試",
      "comment.empty_tip": "留言內容不能為空",
      "comment.too_fast": "留言太快了，休息一下再試",
      "comment.subscribed": "有回覆時以郵件通知我",
      "comment.nickname": "暱稱",
      "comment.email": "信箱",
      "comment.website": "網站",
      "comment.guest": "訪客",
      "comment.input_login_hint": "解鎖後可使用管理員身分留言",
      "comment.feed_hint": "點擊動態卡片右下角的留言圖示，即可針對該則動態發表留言",
      "comment.image_max": "最多 {n} 張圖片",
      "comment.image_size_limit": "圖片不能超過 {size}",
      "comment.upload_image": "上傳圖片",
      "comment.image_url_ph": "圖片 URL，按 Enter 加入",
      "comment.random_one": "隨機一句",
      "comment.notify_mine": "有人回覆我的留言時以郵件通知我",
      "comment.image_url_invalid": "請輸入完整的圖片 URL",
      "comment.owner_badge": "站長",
      "comment.expand_replies": "展開全部 {n} 則回覆",
      "comment.collapse_replies": "收合回覆",
      "comment.expand_more": "展開更多留言（剩餘 {n} 則）",
      "comment.empty_first": "還沒有留言，來說第一句吧",
      "comment.reply_giving": "回覆給",
      "comment.ai_hint": "留言中 @{name} 可召喚 AI 回覆",
      "comment.qq_no_nick": "未取得暱稱，請手動填寫",
      "comment.nick_or_qq_ph": "暱稱或 QQ 號（填 QQ 號自動取得暱稱、信箱、頭像）",
      "comment.email_ph": "信箱 *",
      "comment.website_ph": "網址（選填，頭像可點擊跳轉）",
      "comment.placeholder_mention": "說點什麼…（支援 @ 提及他人）",
      "comment.cancel_locate": "取消定位",
      "comment.select_target_first": "請先選擇留言對象",
      "comment.nickname_required": "請填寫暱稱",
      "comment.email_required": "請填寫信箱",
      "comment.ai_called": "已召喚 {name}，回覆稍後自動出現",

      "music.not_playing": "未播放",
      "music.click_play": "點擊播放",
      "music.playlist": "播放清單",
      "music.close_list": "關閉",
      "music.prev": "上一首",
      "music.next": "下一首",
      "music.play_pause": "播放/暫停",
      "music.mode": "播放模式",
      "music.mode_list": "列表循環",
      "music.mode_random": "隨機播放",
      "music.mode_one": "單曲循環",
      "music.playlist_btn": "播放清單",
      "music.lyric": "歌詞",
      "music.mute": "靜音",
      "music.volume": "音量",
      "music.collapse": "收合",
      "music.cover": "封面",
      "music.no_lyric": "暫無歌詞",
      "music.resolving": "正在解析試聽位址…",
      "music.resolve_ok": "解析成功，開始播放",
      "music.resolve_fail": "試聽解析失敗",
      "music.importing": "正在入庫，請勿關閉…",
      "music.play_fail": "播放失敗，請換一首試試",
      "music.loading": "載入音樂…",
      "music.playlist_empty": "播放清單為空",
      "music.song_n": "歌曲 {n}",
      "music.song_fallback": "歌曲",
      "music.unknown_artist": "未知歌手",
      "music.unknown_song": "未知歌曲",
      "music.no_source_stop": "連續多首歌曲無可用音源，已停止播放",
      "music.no_source_next": "「{name}」暫無可用音源，自動播放下一首",
      "music.load_failed": "音樂載入失敗",
      "music.mode_title": "播放模式：{mode}（點擊切換）",
      "music.mode_toast": "播放模式：{mode}",
      "music.muted_autoplay_tip": "已靜音自動播放，點擊頁面任意處開啟聲音",
      "music.play_failed": "播放失敗",
      "music.play_fail_retry": "播放失敗，請重試",
      "music.lyric_loading": "載入歌詞中…",
      "music.lyric_failed": "歌詞載入失敗",
      "music.unavailable": "音樂無法播放（已下架或版權限制）",
      "music.resolve_no_source": "試聽位址解析失敗，可能暫無音源",
      "music.resolve_success": "試聽位址解析成功",

      "404.title": "頁面走丟了",
      "404.desc": "你造訪的頁面不存在或已被移除。",
      "404.back_home": "返回首頁",

      "lightbox.download": "下載圖片",
      "lightbox.before": "上一張",
      "lightbox.next": "下一張",
      "lightbox.load_failed": "圖片檢視器載入失敗",

      "lang.switch": "切換語言",
      "lang.lang_name": "繁體中文",

      // 內容翻譯按鈕
      "translate.btn_en": "譯為英文",
      "translate.btn_zh_tw": "翻譯為繁體中文",
      "translate.loading": "翻譯中…",
      "translate.note_ai": "本文由 AI 自動翻譯，僅供參考",
      "translate.note_local": "本文已轉換為繁體中文",
      "translate.view_original": "查看原文",
      "translate.view_translation": "查看譯文",
      "translate.error": "翻譯失敗，請稍後重試",
      "translate.title": "翻譯",
    },

    en: {
      "common.loading": "Loading…",
      "common.load_more": "Load more",
      "common.retry": "Retry",
      "common.confirm": "OK",
      "common.cancel": "Cancel",
      "common.close": "Close",
      "common.save": "Save",
      "common.send": "Send",
      "common.submit": "Submit",
      "common.reply": "Reply",
      "common.delete": "Delete",
      "common.edit": "Edit",
      "common.copy": "Copy",
      "common.copied": "Copied",
      "common.link_copied": "Link copied",
      "common.copy_failed": "Copy failed",
      "common.back": "Back",
      "common.back_top": "Back to top",
      "common.expand": "Expand",
      "common.collapse": "Collapse",
      "common.all": "All",
      "common.optional": "optional",
      "common.none": "Nothing yet",
      "common.no_more": "Nothing more to load",
      "common.network_error": "Network error, please try again later",
      "common.request_failed": "Request failed",
      "common.operation_failed": "Operation failed",
      "common.confirm_action": "Are you sure you want to do this?",
      "common.today": "Today",
      "common.yesterday": "Yesterday",
      "common.day": "d",
      "common.just_now": "just now",
      "common.min_ago": "{n} min ago",
      "common.hour_ago": "{n} h ago",
      "common.day_ago": "{n} d ago",
      "common.month_ago": "{n} mo ago",
      "common.year_ago": "{n} y ago",
      "common.prev_page": "Previous",
      "common.page_info": "Page {page} / {pages}",
      "common.next_page": "Next",
      "common.request_error_status": "Request failed ({status})",
      "common.play_video": "Play video",
      "common.image": "Image",
      "common.view_original": "Click to view original",
      "common.original_badge": "Original",
      "common.uploading": "Uploading...",
      "common.upload_failed": "Upload failed",
      "common.footer_runtime": "Up for {days} days {hh}:{mm}:{ss}",
      "common.open_menu": "Open menu",
      "common.close_menu": "Close menu",
      "common.video_not_found": "No video on this page",
      "common.retry_suffix": "{msg}, click to retry",
      "common.theme_light": "Switch to light mode",
      "common.theme_dark": "Switch to dark mode",

      "nav.feed": "Home",
      "nav.posts": "Posts",
      "nav.photos": "Photos",
      "nav.links": "Links",
      "nav.friends": "Friends",
      "nav.about": "About",
      "nav.admin": "Admin",

      "search.title": "Search",
      "search.placeholder": "Search posts, moments, links…",
      "search.clear": "Clear",
      "search.hint_select": "↑↓ navigate",
      "search.hint_open": "Enter to open",
      "search.hint_close": "Esc to close",
      "search.empty": "Nothing found",
      "search.loading": "Searching…",
      "search.tab_all": "All",
      "search.tab_posts": "Posts",
      "search.tab_moments": "Moments",
      "search.tab_friends": "Links",
      "search.result_count": "About {n} results",
      "search.input_hint": "Type a keyword to search posts, moments, and links",
      "search.no_text": "(no text)",
      "search.no_result": "No results for \u201c{q}\u201d",
      "search.more": "See more \u201c{name}\u201d results \u2192",
      "search.total": "{n} results",
      "search.failed": "Search failed",

      "feed.empty": "No moments yet",
      "feed.pinned": "Pinned",
      "feed.location": "at",
      "feed.expand_full": "Expand",
      "feed.collapse": "Collapse",
      "feed.like": "Like",
      "feed.comment": "Comment",
      "feed.liked": "Liked",
      "feed.load_older": "Load more moments",
      "feed.publish": "New moment",
      "feed.ago_at": "{time} · {loc}",
      "feed.confirm_delete": "Delete this moment? This cannot be undone.",
      "feed.deleted": "Deleted",
      "feed.delete_failed": "Delete failed",
      "feed.like_failed": "Action failed, please try again later",
      "feed.unlike": "Unlike",
      "feed.loading_more": "Loading more moments...",
      "feed.scroll_more": "Scroll down for more moments",
      "feed.reached_end": "\u2014 You're all caught up \u2014",
      "feed.search_title": "Search \u201c{q}\u201d \u00b7 {site}",
      "feed.filter_only": "🔍 Showing only moments containing \u201c{q}\u201d",
      "feed.clear_filter": "Clear filter",
      "feed.read_full": "Read more \u2192",
      "feed.moment_hash": "Moment #{id}",

      // Off-site video notice
      "video.yt_blocked": "This video is hosted on YouTube and may be unreachable on your current network. Please check your connection to watch it.",
      "video.open_youtube": "Open on YouTube ↗",
      "video.load_failed": "Failed to load the video. The source may be temporarily unavailable or your connection may be unstable.",
      "video.retry": "Click to retry",

      "posts.title": "Posts",
      "posts.empty": "No posts yet",
      "posts.continue": "Continue reading",
      "posts.toc": "Contents",
      "posts.toc_open": "Table of contents",
      "posts.prev": "Previous",
      "posts.next": "Next",
      "posts.related": "Related posts",
      "posts.published_at": "Published",
      "posts.updated_at": "Updated",
      "posts.words": "{n} words",
      "posts.reading_time": "{n} min read",
      "posts.views": "{n} views",
      "posts.back_list": "Back to posts",
      "posts.untitled": "Untitled",
      "posts.tag": "Post",
      "posts.total": "{n} posts",
      "posts.reward_default": "If you enjoyed this post, your support is much appreciated ~",
      "posts.reward_qr_alt": "Tip QR code",
      "posts.toc_empty_heading": "Heading",
      "posts.toc_collapse": "Collapse contents",
      "posts.toc_close": "Close contents",
      "posts.back_home": "Back home",
      "posts.back_list_short": "Back to list",

      "photos.title": "Photos",
      "photos.empty": "No photos yet",
      "photos.count": "{n} photos",
      "photos.total": "{n} photos",
      "photos.page_desc": "{n} photos \u00b7 Every moment worth keeping",
      "photos.empty_hint": "No photos in this album yet",
      "photos.empty_tip": "Upload in the admin \u201cPhoto Manager\u201d, or sync from moments and posts",

      "links.title": "Friends",
      "links.apply": "Apply for a link",
      "links.empty": "No links yet",
      "links.visit": "Visit",
      "links.category_all": "All",
      "links.apply_intro": "Happy to exchange links — submit the form below or leave a comment.",
      "links.apply_site_name": "Site name",
      "links.apply_site_url": "Site URL",
      "links.apply_avatar": "Avatar URL",
      "links.apply_desc": "Description",
      "links.apply_email": "Email",
      "links.apply_submit": "Submit application",
      "links.apply_success": "Application submitted, pending review",
      "links.no_desc": "This person is too lazy to leave a description.",
      "feed.moment_tag": "Moment",
      "links.last_post_today": "Updated today",
      "links.last_post_yesterday": "Updated yesterday",
      "links.last_post_days": "Updated {n} days ago",
      "links.last_post_stale": "No updates for over a month",
      "links.not_subscribed": "Not in friends circle",
      "links.fetch_error": "Fetch error",
      "links.fetch_pending": "Pending",
      "links.empty_apply_tip": 'No links yet \u2014 <a href="/links/apply">apply for one</a>\uff5e',
      "links.eyebrow": "LINKS \u00b7 FRIENDS",
      "links.subtitle": "A collection of independent blogs and friend sites I keep coming back to. Each has its own rhythm \u2014 take your time.",
      "links.stat_total": "Friends",
      "links.stat_categories": "Categories",
      "links.stat_new": "New this month",
      "links.apply_banner_title": "Want your site here too?",
      "links.apply_banner_desc": "Just submit your site info or email me. I usually reply within 48 hours, and approved sites join this wall of friends.",
      "links.apply_eyebrow": "EXCHANGE \u00b7 APPLY",
      "links.apply_subtitle": "If you blog too, let's exchange links. Please make sure your site meets the rules below before submitting.",
      "links.rules_title": "Link rules",
      "links.rules_intro": "To keep this wall worth reading, only original, regularly updated personal sites are listed.",
      "links.rules_1": "Mostly original content; no illegal, scraped, or advertising material",
      "links.rules_2": "The site has been online for at least 6 months with ongoing updates",
      "links.rules_3": "A link back to this site is placed on the homepage and works",
      "links.rules_4": "No forced redirects, pop-ups, or intrusive ads",
      "links.rules_5": "Content relates to reading, photography, design, or technology",
      "links.site_info_title": "This site's info",
      "links.site_info_desc": "Copy the info below into your own links page.",
      "links.apply_site_brief": "Site intro",
      "links.apply_form_title": "Submit application",
      "links.apply_form_tip": "I'll review it as soon as I can; once approved your site is added automatically.",
      "links.apply_name_ph": "e.g. Cloud Notes",
      "links.fetch_auto": "Auto-fetch",
      "links.apply_desc_ph": "One line about your site",
      "links.apply_category": "Category",
      "links.apply_feed_url": "Feed URL",
      "links.apply_feed_ph": "https://example.com/feed.xml (optional)",
      "links.apply_feed_hint": "If provided, the feed will be included in Friends Circle after approval; leave blank for manual setup later",
      "links.review_title": "Review process",
      "links.review_1_title": "Submitted",
      "links.review_1_desc": "Form submitted successfully",
      "links.review_2_title": "Manual review",
      "links.review_2_desc": "I usually reply within 48 hours; the result goes to your email",
      "links.review_3_title": "Listed",
      "links.review_3_desc": "Once approved, your site is added to the wall automatically",
      "links.apply_status_title": "Application Status",
      "links.apply_status_sub": "Review progress of all friend link applications",
      "links.tab_all": "All",
      "links.tab_pending": "Pending",
      "links.tab_approved": "Approved",
      "links.tab_rejected": "Rejected",
      "links.no_pending": "No pending applications",
      "links.no_approved": "No approved applications",
      "links.no_rejected": "No rejected applications",
      "links.no_records": "No records",
      "links.status_pending": "Pending",
      "links.status_approved": "Approved",
      "links.status_rejected": "Rejected",
      "links.time_today": "Today",
      "links.time_yesterday": "Yesterday",
      "links.fill_url_first": "Please enter the site URL first",
      "links.fetching": "Fetching\u2026",
      "links.fetch_auto_ok": "Site info fetched automatically \u2014 feel free to tweak",
      "links.fetch_auto_fail": "Fetch failed, please fill in manually",
      "links.apply_toast": "Application submitted \u2014 it will appear in the list once approved",
      "links.submit_failed": "Submission failed",
      "links.apply_seo_desc": "Submit your site info and apply to join the friends wall.",

      "about.stats_title": "By the numbers",
      "about.timeline_title": "Timeline",
      "about.contacts_title": "Contact",
      "about.sponsor_title": "Support",
      "about.sponsor_action": "Buy me a coffee",
      "about.greeting_default": "About me",
      "about.bio_title": "A little about me",
      "about.timeline_heading": "A few milestones along the way",
      "about.recent_title": "Some recent writing",
      "about.view_all": "View all",
      "about.bigstats_title": "So far, this many people stopped by.",
      "about.contact_heading": "Want to chat? Find me here.",
      "about.qr_alt": "Support QR code",
      "about.coffee_title": "Buy me a coffee",
      "about.select_amount": "Choose an amount",
      "about.scan_tip": "Scan to support, thank you ❤",

      "comment.title": "Comments",
      "comment.count": "{n} comments",
      "comment.placeholder": "Write something…",
      "comment.submit": "Post comment",
      "comment.reply_to": "Reply to {name}",
      "comment.cancel_reply": "Cancel reply",
      "comment.view_more": "View all {n} comments",
      "comment.hide": "Collapse comments",
      "comment.no_comments": "No comments yet. Be the first to say something～",
      "comment.deleted": "This comment has been deleted",
      "comment.pending": "Comment pending review",
      "comment.confirm_delete": "Delete this comment?",
      "comment.owo": "Emoji",
      "comment.image": "Image",
      "comment.at": "reply",
      "comment.emoji_panel": "Emoji",
      "comment.reply_success": "Comment posted",
      "comment.reply_failed": "Failed to post comment, please try again later",
      "comment.empty_tip": "Comment cannot be empty",
      "comment.too_fast": "You're commenting too fast, take a breath",
      "comment.subscribed": "Notify me of replies by email",
      "comment.nickname": "Nickname",
      "comment.email": "Email",
      "comment.website": "Website",
      "comment.guest": "Guest",
      "comment.input_login_hint": "Unlock to comment as the admin",
      "comment.feed_hint": "Tap the comment icon at the bottom-right of a moment card to comment on that moment",
      "comment.image_max": "Up to {n} images",
      "comment.image_size_limit": "Images must be under {size}",
      "comment.upload_image": "Upload image",
      "comment.image_url_ph": "Image URL, press Enter to add",
      "comment.random_one": "Random line",
      "comment.notify_mine": "Email me when someone replies to my comment",
      "comment.image_url_invalid": "Please enter a complete image URL",
      "comment.owner_badge": "Author",
      "comment.expand_replies": "Show all {n} replies",
      "comment.collapse_replies": "Hide replies",
      "comment.expand_more": "Show more comments ({n} hidden)",
      "comment.empty_first": "No comments yet \u2014 be the first to say something",
      "comment.reply_giving": "Replying to",
      "comment.ai_hint": "Mention @{name} in a comment to summon an AI reply",
      "comment.qq_no_nick": "Couldn't fetch a nickname, please enter one manually",
      "comment.nick_or_qq_ph": "Nickname or QQ number (a QQ number auto-fills nickname, email, avatar)",
      "comment.email_ph": "Email *",
      "comment.website_ph": "Website (optional; avatar links to it)",
      "comment.placeholder_mention": "Write something\u2026 (you can @mention others)",
      "comment.cancel_locate": "Cancel locate",
      "comment.select_target_first": "Please pick a comment to reply to first",
      "comment.nickname_required": "Please enter a nickname",
      "comment.email_required": "Please enter your email",
      "comment.ai_called": "{name} summoned \u2014 the reply will appear shortly",

      "music.not_playing": "Not playing",
      "music.click_play": "Tap to play",
      "music.playlist": "Playlist",
      "music.close_list": "Close",
      "music.prev": "Previous",
      "music.next": "Next",
      "music.play_pause": "Play/Pause",
      "music.mode": "Playback mode",
      "music.mode_list": "Loop all",
      "music.mode_random": "Shuffle",
      "music.mode_one": "Repeat one",
      "music.playlist_btn": "Playlist",
      "music.lyric": "Lyrics",
      "music.mute": "Mute",
      "music.volume": "Volume",
      "music.collapse": "Collapse",
      "music.cover": "Cover",
      "music.no_lyric": "No lyrics",
      "music.resolving": "Resolving playback URL…",
      "music.resolve_ok": "Resolved, now playing",
      "music.resolve_fail": "Failed to resolve playback URL",
      "music.importing": "Importing, please keep this page open…",
      "music.play_fail": "Playback failed, try another track",
      "music.loading": "Loading music…",
      "music.playlist_empty": "Playlist is empty",
      "music.song_n": "Track {n}",
      "music.song_fallback": "Track",
      "music.unknown_artist": "Unknown artist",
      "music.unknown_song": "Unknown track",
      "music.no_source_stop": "Multiple tracks in a row have no playable source; playback stopped",
      "music.no_source_next": "\u201c{name}\u201d has no playable source; skipping to the next track",
      "music.load_failed": "Failed to load music",
      "music.mode_title": "Playback mode: {mode} (click to switch)",
      "music.mode_toast": "Playback mode: {mode}",
      "music.muted_autoplay_tip": "Muted autoplay is on \u2014 click anywhere on the page to enable sound",
      "music.play_failed": "Playback failed",
      "music.play_fail_retry": "Playback failed, please retry",
      "music.lyric_loading": "Loading lyrics…",
      "music.lyric_failed": "Failed to load lyrics",
      "music.unavailable": "This track is unavailable (removed or region-restricted)",
      "music.resolve_no_source": "Couldn't resolve the playback URL; no source available",
      "music.resolve_success": "Playback URL resolved",

      "404.title": "Page not found",
      "404.desc": "The page you requested does not exist or has been removed.",
      "404.back_home": "Back home",

      "lightbox.download": "Download image",
      "lightbox.before": "Previous",
      "lightbox.next": "Next",
      "lightbox.load_failed": "Failed to load the image viewer",

      "lang.switch": "Language",
      "lang.lang_name": "English",

      // Content translation
      "translate.btn_en": "Translate to English",
      "translate.btn_zh_tw": "Translate to Traditional Chinese",
      "translate.loading": "Translating…",
      "translate.note_ai": "Translated by AI for reference only",
      "translate.note_local": "Converted to Traditional Chinese",
      "translate.view_original": "View original",
      "translate.view_translation": "View translation",
      "translate.error": "Translation failed. Please try again later.",
      "translate.title": "Translate",
    },
  };

  var LANG_LABELS = {
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文",
    en: "English",
  };
  var LANG_SHORT = { "zh-CN": "简", "zh-TW": "繁", en: "EN" };
  var INTL_TAG = { "zh-CN": "zh-CN", "zh-TW": "zh-TW", en: "en" };

  function readStored() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return SUPPORTED.indexOf(v) >= 0 ? v : null;
    } catch (_) {
      return null;
    }
  }

  function readBoot() {
    try {
      var b = window.__I18N_BOOT__;
      if (b && SUPPORTED.indexOf(b.lang) >= 0) return b;
    } catch (_) {}
    return null;
  }

  function guessNavigator() {
    var l = (navigator.language || "zh-CN").toLowerCase();
    if (l.indexOf("zh-hant") === 0 || l.indexOf("zh-tw") === 0 || l.indexOf("zh-hk") === 0 || l.indexOf("zh-mo") === 0) return "zh-TW";
    if (l.indexOf("zh") === 0) return "zh-CN";
    if (l.indexOf("en") === 0) return "en";
    return null;
  }

  /** 首屏同步初始语言（index.html 内联脚本也会调用一份相同逻辑设置 <html lang>） */
  function initialLang() {
    return readStored() || (readBoot() && readBoot().lang) || guessNavigator() || "zh-CN";
  }

  var I18N = {
    lang: initialLang(),
    enabled: false,
    defaultLang: "zh-CN",
    langs: SUPPORTED.slice(),
    manual: !!readStored(),
    _boot: readBoot(),
    _listeners: [],

    /** 语言自显名称 / 短标签 */
    labelOf: function (l) {
      return LANG_LABELS[l] || l;
    },
    shortOf: function (l) {
      return LANG_SHORT[l] || l;
    },
    intlTag: function () {
      return INTL_TAG[this.lang] || "zh-CN";
    },

    /** 由站点设置同步开关/默认/开放语言；返回最终语言 */
    configure: function (s) {
      if (!s) return this.lang;
      this.enabled = !!s.i18n_enabled;
      this.defaultLang = SUPPORTED.indexOf(s.i18n_default) >= 0 ? s.i18n_default : "zh-CN";
      var raw = String(s.i18n_langs || "")
        .split(",")
        .map(function (x) {
          return x.trim();
        })
        .filter(function (x) {
          return SUPPORTED.indexOf(x) >= 0;
        });
      this.langs = raw.length ? raw : ["zh-CN"];

      if (!this.enabled) {
        this.lang = this.defaultLang;
      } else if (this.langs.indexOf(this.lang) < 0) {
        // 当前语言被管理员下架：手动选择优先，其次默认
        var stored = readStored();
        this.lang = stored && this.langs.indexOf(stored) >= 0 ? stored : this.defaultLang;
      }
      this._syncHtml();
      return this.lang;
    },

    /** 地理检测结果回填（仅当用户未手动选择时生效） */
    applyDetected: function (lang) {
      if (this.manual) return false;
      if (!lang || this.langs.indexOf(lang) < 0 || lang === this.lang) return false;
      this.lang = lang;
      this._syncHtml();
      return true;
    },

    /** 手动切换：持久化并通知重渲染 */
    setLang: function (lang) {
      if (SUPPORTED.indexOf(lang) < 0) return;
      this.lang = lang;
      this.manual = true;
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (_) {}
      try {
        document.cookie = COOKIE_KEY + "=" + lang + ";path=/;max-age=31536000;SameSite=Lax";
      } catch (_) {}
      this._syncHtml();
      this._emit();
    },

    t: function (key, vars) {
      var s = (DICT[this.lang] && DICT[this.lang][key]) || (DICT["zh-CN"] && DICT["zh-CN"][key]) || key;
      if (vars) {
        s = s.replace(/\{(\w+)\}/g, function (_, k) {
          return vars[k] === undefined || vars[k] === null ? "" : String(vars[k]);
        });
      }
      return s;
    },

    on: function (fn) {
      this._listeners.push(fn);
    },

    /** 翻译静态节点：data-i18n=textContent，data-i18n-title/placeholder/aria-label/value */
    applyStatic: function (root) {
      if (!this.enabled) {
        // 关闭时仍需把默认语言（可能被浏览器猜成 en）刷回 zh-CN 静态文案
      }
      var scope = root || document;
      var self = this;
      scope.querySelectorAll("[data-i18n]").forEach(function (el) {
        el.textContent = self.t(el.getAttribute("data-i18n"));
      });
      ["title", "placeholder", "aria-label", "value", "alt"].forEach(function (attr) {
        scope.querySelectorAll("[data-i18n-" + attr + "]").forEach(function (el) {
          el.setAttribute(attr, self.t(el.getAttribute("data-i18n-" + attr)));
        });
      });
    },

    /** 相对时间（与原 timeAgo 粒度一致） */
    timeAgo: function (dateString) {
      if (!dateString) return "";
      var date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      var seconds = Math.floor((Date.now() - date.getTime()) / 1000);
      if (seconds < 0) return this.t("common.just_now");
      var minutes = Math.floor(seconds / 60);
      var hours = Math.floor(minutes / 60);
      var days = Math.floor(hours / 24);
      var months = Math.floor(days / 30);
      var years = Math.floor(days / 365);
      if (seconds < 60) return this.t("common.just_now");
      if (minutes < 60) return this.t("common.min_ago", { n: minutes });
      if (hours < 24) return this.t("common.hour_ago", { n: hours });
      if (days < 30) return this.t("common.day_ago", { n: days });
      if (months < 12) return this.t("common.month_ago", { n: months });
      return this.t("common.year_ago", { n: years });
    },

    _syncHtml: function () {
      document.documentElement.lang = this.lang === "zh-TW" ? "zh-Hant" : this.lang;
    },

    _emit: function () {
      this.applyStatic(document);
      this._listeners.forEach(function (fn) {
        try {
          fn();
        } catch (_) {}
      });
    },
  };

  window.I18N = I18N;
  window.t = function (key, vars) {
    return I18N.t(key, vars);
  };

  /* 首屏静态文案：脚本位于 body 末尾，DOM 已就绪。
     优先用 localStorage 缓存设置；无缓存时参考 SSR 注入的 enabled/langs。
     app.js 拿到最新设置后会再次 configure，结果幂等。 */
  (function earlyPaint() {
    var s = null;
    try {
      s = JSON.parse(localStorage.getItem("moments_settings") || "null");
    } catch (_) {}
    if (s && typeof s === "object") {
      I18N.configure(s);
    } else if (window.__I18N_BOOT__) {
      var b = window.__I18N_BOOT__;
      I18N.enabled = !!b.enabled;
      I18N.defaultLang = b.default || "zh-CN";
      I18N.langs = (b.langs && b.langs.length ? b.langs : SUPPORTED.slice());
      if (I18N.enabled && I18N.langs.indexOf(I18N.lang) < 0) I18N.lang = b.lang;
      I18N._syncHtml();
    }
    if (I18N.enabled) I18N.applyStatic(document);
  })();
})();
