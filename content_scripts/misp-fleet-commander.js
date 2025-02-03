(() => {
    /**
    * Check and set a global guard variable.
    * If this content script is injected into the same page again,
    * it will do nothing next time.
    */
    if (window.MFC_hasRun) {
        return;
    }
    window.MFC_hasRun = true;

    const MISP_BASEURL = window.location.origin

    if (typeof browser === "undefined") {
        var browser = chrome;
    }

    browser.runtime.onMessage.addListener((message, sender, sendReponse) => {
        switch (message.command) {
            case 'notify':
                showToast(message.payload.title, message.payload.message, message.payload.variant)
                break;
            case 'create-api-key':
                createApiKey().then((APIKey) => {
                    sendReponse(APIKey)
                })
                return true // Keep the channel open until sendDresponse is called
            case 'check-if-MISP':
                let isMISP = false
                try {
                    isMISP = checkIfMISP()
                } catch (error) {
                    console.error(error);
                }
                sendReponse(isMISP)
                break;
            default:
                console.warn(`Wrong commang ${message.command}`)
                break;
        }
    });

    function checkIfMISP() {
        const footer = document.querySelector('.footerText.footerCenterText a')
        if (footer) {
            return document.querySelector('.footerText.footerCenterText a').innerText.startsWith('MISP')
        }
        return false
    }

    async function createApiKey() {
        const url = `/auth_keys/add/me`
        const response = await fetch(url, {
            headers: { "Content-Type": "application/json; charset=utf-8", "Accept": "application/json" },
            method: 'POST',
            body: JSON.stringify({
                AuthKey: {
                    comment: 'Authkey for MISP Fleet Commander',
                    read_only: 0,
                    allowed_ips: '',
                    expiration: '',
                }
            })
        })
        if (!response.ok) {
            throw new Error(`${response.status}: ${response.statusText}`)
        }
        return await response.json()
    }

    function showToast(title, message, variant) {
        const variantMappingBGHead = {
            'success': '#6ee7b7',
            'warning': '#fde047',
            'danger': '#fca5a5',
            'info': '#bee5eb',
        }
        const variantMappingBGBody = {
            'success': '#dcfce7',
            'warning': '#fef9c3',
            'danger': '#fee2e2',
            'info': '#d1ecf1',
        }
        const variantMappingBorder = {
            'success': '#4ade80',
            'warning': '#facc15',
            'danger': '#f87171',
            'info': '#bee5eb',
        }
        const toastHTML = `
            <div style="position: absolute; top: 60px; right: 10px; border: 1px solid ${variantMappingBorder[variant]}; border-radius: 3px;">
                <div style="padding: 0.5em; border-bottom: 1px solid ${variantMappingBorder[variant]}; background-color: ${variantMappingBGHead[variant]};">
                    <img src="${chrome.runtime.getURL('icons/mfc-32.png')}" style="width: 32px;" alt="MISP Fleet Commander logo">
                    <strong style="margin-left: .5em;">${title}</strong>
                </div>
                <div style="padding: 0.5em; background-color: ${variantMappingBGBody[variant]};">${message}</div>
            </div>`
        const div = document.createElement('div')
        div.innerHTML = toastHTML
        document.querySelector('body').append(div)
        setTimeout(() => {
            div.remove()
        }, 7000);
    }


})();
