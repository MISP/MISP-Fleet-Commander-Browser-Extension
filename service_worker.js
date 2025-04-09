

(function () {
    if (typeof browser === "undefined") {
        var browser = chrome;
    }

    const token_type = 'apikey'


    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete') {
            getSettings().then(async (settings) => {
                if (settings.notify_if_server_not_found) {
                    const MISP_BASEURL = new URL(tab.url).origin
                    const shouldNotify = await shouldNotifyServerNotFound(MISP_BASEURL, settings.notify_if_server_not_found_notification_timestamp)
                    if (!shouldNotify) {
                        return
                    }
                    const fleetsContainThisURL = await checkIfFleetsContainThisURL(settings, tab);
                    if (fleetsContainThisURL.length == 0) {
                        sendMessage('notify', {
                            'title': 'This server is not enrolled in a fleet.',
                            'message': 'Click the MISP Fleet Commander extension to <strong>enroll now</strong>!',
                            'variant': 'info',
                        })
                    }
                }
            }).catch(error => {
                console.error('Error getting settings:', error);
            });
        }
    });

    function getSettings() {
        return new Promise((resolve, reject) => {
            browser.storage.local.get().then((settings) => {
                resolve({
                    MFC_URL: settings.MFM_baseurl,
                    token: settings.MFM_token,
                    notify_if_server_not_found: settings.MFM_notify_if_server_not_found,
                    last_selected_fleet: settings.last_selected_fleet,
                    notify_if_server_not_found_notification_timestamp: settings.notify_if_server_not_found_notification_timestamp,
                })
            })
        });
    }

    async function setServerNotFoundNotificationCount(MISP_BASEURL, notify_if_server_not_found_notification_timestamp) {
        const now = Date.now()
        const updatedSetting = notify_if_server_not_found_notification_timestamp === undefined ? {} : notify_if_server_not_found_notification_timestamp
        updatedSetting[MISP_BASEURL] = now
        browser.storage.local.set({
            notify_if_server_not_found_notification_timestamp: updatedSetting,
        })
    }

    async function shouldNotifyServerNotFound(MISP_BASEURL, notify_if_server_not_found_notification_timestamp) {
        if (
            notify_if_server_not_found_notification_timestamp === undefined || 
            notify_if_server_not_found_notification_timestamp[MISP_BASEURL] === undefined
        ) {
            setServerNotFoundNotificationCount(MISP_BASEURL, notify_if_server_not_found_notification_timestamp)
            return true
        }
        const now = Date.now()
        const notificationFreq = 1000 * 10 * 60 // 10min

        if ((now - notify_if_server_not_found_notification_timestamp[MISP_BASEURL]) > notificationFreq) {
            setServerNotFoundNotificationCount(MISP_BASEURL, notify_if_server_not_found_notification_timestamp)
            return true
        }
        setServerNotFoundNotificationCount(MISP_BASEURL, notify_if_server_not_found_notification_timestamp)
        return false
    }

    async function checkIfFleetsContainThisURL(settings, tab) {
        const MISP_BASEURL = new URL(tab.url).origin
        const browsingMISP = await checkIfMISP()
        let fleets = null
        if (!browsingMISP) {
            return
        }
        try {
            fleets = await getFleetIndex(settings)
        } catch (error) {
            return
        }
        const fleetsContainThisURL = fleets.filter((f) => { return f.servers.some((s) => s.url == MISP_BASEURL) })
        return fleetsContainThisURL
    }

    async function getFleetIndex(settings) {
        const url = `${settings.MFC_URL}/fleets/index`
        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
                "Authorization": `${token_type} ${settings.token}`
            },
            method: 'GET',
        })
        if (!response.ok) {
            throw new Error(`${response.status}: ${response.statusText}`)
        }
        return response.json()
    }

    async function checkIfMISP() {
        return await sendMessage('check-if-MISP')
    }


    async function sendMessage(command, payload) {
        const tabs = await browser.tabs.query({ currentWindow: true, active: true })
        return browser.tabs.sendMessage(tabs[0].id, {
            command: command,
            payload: payload
        })
    }
})();