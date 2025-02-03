if (typeof browser === "undefined") {
    var browser = chrome;
}

let MISP_BASEURL = null
let MFC_URL = null
// let notify_if_server_not_found = null
let token = null
let last_selected_fleet = null
const token_type = 'apikey'

async function getCurrentTab() {
    let queryOptions = {
        active: true,
        currentWindow: true
    };
    let [tab] = await browser.tabs.query(queryOptions);
    return await tab;
}

window.onload = async () => {
    initContext()
        .then(() => {
            startImport()
        })
}

async function initContext() {
    document.getElementById('button-settings').addEventListener('click', function() {
        console.log('click');
        browser.runtime.openOptionsPage()
    })
    const tabs = await browser.tabs.query({currentWindow: true, active: true})

    const settings = await browser.storage.local.get();
    MFC_URL = settings.MFM_baseurl
    token = settings.MFM_token
    last_selected_fleet = settings.last_selected_fleet
    MISP_BASEURL = new URL(tabs[0].url).origin
}

async function doImport() {
    const fleetID = document.querySelector('input[type="radio"][name="fleet_id"]:checked').value
    const serverName = document.querySelector('input#server_name').value
    const serverDescription = document.querySelector('input#server_description').value

    let instanceInfo
    try {
        instanceInfo = await fetchInstanceInfo()
    } catch (error) {
        showError(`Could not fetch instance info.`)
        showError(error)
        return
    }
    instanceInfo.server_name = serverName
    instanceInfo.server_description = serverDescription
    const serverData = buildServerQuery(instanceInfo)

    try {
        result = await addServer(fleetID, serverData)
        if (result.url !== undefined ) {
            sendSuccessNotification('Successfully enrolled server', `${serverName} was successfully registered in MISP Fleet Commander.`)
            window.close()
        }
    } catch (error) {
        showError(`Could not import server to \`${MFC_URL}\``)
        showError(error)
        return
    } finally {
        toggleLoading(false)
    }
}

async function populateImportOptions() {
    let fleets = []
    toggleLoading(true)
    try {
        fleets = await getFleetIndex()
    } catch (error) {
        showError(error)
        showError(`Could not fetch available fleets from MISP Fleet Commander \`${MFC_URL}\``)
        return
    } finally {
        toggleLoading(false)
    }
    if (fleets === undefined) {
        return
    }
    const fleetIDContainer = document.getElementById('fleet-container')
    const fleetIDsContainingThisURL = fleets.filter((f) => { return f.servers.some((s) => s.url == MISP_BASEURL) }).map((f) => f.id)
    fleets.forEach((fleet, i) => {
        let fleetContainer = document.createElement("div")
        fleetContainer.style['display'] = 'flex'
        fleetContainer.style['align-items'] = 'center'
        fleetContainer.style['margin'] = '0.5em 0'
        let fleetIDInput = document.createElement("input")
        setDOMAttributes(fleetIDInput, {
            type: 'radio',
            id: fleet.id,
            name: 'fleet_id',
            value: fleet.id,
        })
        fleetIDInput['style']['margin-top'] = 0;
        if (fleet.id == last_selected_fleet) {
            fleetIDInput.checked = true
        }
        fleetIDInput.addEventListener('change', function() {
            browser.storage.local.set({
                last_selected_fleet: this.value,
            })
        })
        let fleetLabel = document.createElement("label")
        fleetLabel.setAttribute('for', fleet.id)
        fleetLabel.innerText = fleet.name
        fleetLabel.style['font-weight'] = '600'

        
        fleetContainer.appendChild(fleetIDInput)
        fleetContainer.appendChild(fleetLabel)

        if (fleetIDsContainingThisURL.includes(fleet.id)) {
            const fleetInfo = document.createElement("small")
            fleetInfo.innerText = 'Found'
            fleetInfo.style['display'] = 'inline-block'
            fleetInfo.style['color'] = '#fff'
            fleetInfo.style['background-color'] = '#dc3545'
            fleetInfo.style['margin-left'] = '0.5em'
            fleetInfo.style['font-size'] = '75%'
            fleetInfo.style['font-weight'] = '700'
            fleetInfo.style['padding'] = '0.2em'
            fleetInfo.style['border-radius'] = '0.5em'
            fleetContainer.appendChild(fleetInfo)
        }
        fleetIDContainer.appendChild(fleetContainer)

        const importBtn = document.getElementById('enroll-server')
        importBtn.onclick = function () { doImport() }
    });

    // Instance name
    const serverURLInput = document.getElementById('server_url')
    serverURLInput.value = MISP_BASEURL
    const serverNameInput = document.getElementById('server_name')
    serverNameInput.value = MISP_BASEURL
    const serverDescriptionInput = document.getElementById('server_description')
    serverDescriptionInput.value = 'imported via MFC plugin'
    const mfcTextField = document.getElementById('mfc_url')
    mfcTextField.textContent = MFC_URL
    mfcTextField.href = MFC_URL
}

async function startImport() {

    toggleLoading(true)

    let isMISP = false
    toggleLoading(true)
    try {
        isMISP = await sendMessage('check-if-MISP')
    } catch (error) {
        console.error(error);
        showError(error)
    } finally {
        toggleLoading(false)
    }
    if (!isMISP) {
        showError('It looks like you\'re not on a MISP page. Try again while logged-in in MISP!')
        return
    }
    console.debug('We are on MISP!');

    let user = false
    toggleLoading(true)
    try {
        user = await getUser()
    } catch (error) {
        console.error(error)
        showError(error)
    } finally {
        toggleLoading(false)
    }

    let proceed = false
    if (!user.Role) {
        showError('Could not get logged user. Make sure you\'re logged in and viewing a MISP page!')
        return
    }
    console.debug('User retreived');
    if (isUserAdmin(user)) {
        proceed = true
    } else {
        proceed = askUserNotAdmin(user)
    }

    if (!proceed) {
        return
    }

    let MFCUser = false
    try {
        MFCUser = await getCurrentUser()
    } catch (error) {
        showError(`Cannot reach MISP Fleet Commander at \`${MFC_URL}\`. Make sure the application URL and API key are correctly defined in the settings.`)
        showError(error)
        return
    } finally {
        toggleLoading(false)
    }
    greetMFCUser(MFCUser)

    populateImportOptions()
}

async function sendMessage(command, payload) {
    const tabs = await browser.tabs.query({currentWindow: true, active: true})
    return browser.tabs.sendMessage(tabs[0].id, {
        command: command,
        payload: payload
    })
}

/**
 * MISP Fleet Commander API Functions
 */

async function getCurrentUser() {
    const url = `${MFC_URL}/users/view/me`
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
            "Authorization": `${token_type} ${token}`
        },
        method: 'GET',
    })
    if (!response.ok) {
        console.log(response);
        throw new Error(`${response.status}: ${response.statusText}`)
    }
    return response.json()
}

async function getFleetIndex() {
    const url = `${MFC_URL}/fleets/index`
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
            "Authorization": `${token_type} ${token}`
        },
        method: 'GET',
    })
    if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`)
    }
    return response.json()
}

async function addServer(fleetID, serverData) {
    const url = `${MFC_URL}/servers/add/${fleetID}`
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `${token_type} ${token}`
        },
        method: 'POST',
        body: JSON.stringify(serverData)
    })
    if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`)
    }
    return response.json()
}


/**
 * MISP API Functions
 */

async function fetchInstanceInfo() {
    let fullApiKey
    try {
        fullApiKey = await createApiKey()
        console.log(fullApiKey);
    } catch (error) {
        showError(`Could not generate an API key.`)
        throw error
    }
    if (fullApiKey.AuthKey === undefined) {
        throw new Error(`Could not parse received API key.`)
    }
    data = {
        url: MISP_BASEURL,
        apiKey: fullApiKey.AuthKey.authkey_raw,
    }
    return data
}

async function getUser() {
    const url = `${MISP_BASEURL}/users/view/me.json`
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
    })
    if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`)
    }
    return response.json()
}

async function createApiKey() {
    return await sendMessage('create-api-key')
}


/**
 * Helper Functions
 */

function isUserAdmin(user) {
    return user.Role.perm_site_admin
}

function askUserNotAdmin(user) {
    return confirm(`Current user is not an admin user! Proceed to add this instance with the current user (Role: ${user.Role.name}) ?`)
}

function buildServerQuery(instanceInfo) {
    return {
        name: instanceInfo.server_name,
        url: instanceInfo.url,
        authkey: instanceInfo.apiKey,
        comment: instanceInfo.server_description,
    }
}

function setDOMAttributes(el, attrs) {
    for(var key in attrs) {
        el.setAttribute(key, attrs[key]);
    }
}

function greetMFCUser(MFCUser) {
    document.getElementById('mfc-user').innerText = MFCUser.email
}

function showError(error) {
    const formContainer = document.getElementById('form-container')
    const errorContainer = document.getElementById('error-container')
    formContainer.classList.add('hidden')
    errorContainer.classList.remove('hidden')
    const errorMessage = document.createElement("p")
    errorMessage.textContent = error
    errorContainer.appendChild(errorMessage)
}

function sendSuccessNotification(title, message) {
    const successContainer = document.getElementById('success-container')
    successContainer.classList.remove('hidden')
    document.querySelector('#success-container .title').innerText = title
    document.querySelector('#success-container .message').innerText = message
    setTimeout(() => {
        successContainer.classList.add('hidden')
    }, 5000);

    sendMessage('notify', {
        'title': title,
        'message': message,
        'variant': 'success',
    })

    browser.notifications.create('server_created', {
        title: title,
        message: message,
        type: 'basic',
        iconUrl: chrome.runtime.getURL('../icons/mfc-96.png'),
    }, () => {})
}

function toggleLoading(isLoading) {
    if (isLoading) {
        document.getElementById('loading-container').style = 'display: block;'
    } else {
        document.getElementById('loading-container').style = 'display: none;'
    }
}

/**
 * There was an error executing the script.
 * Display the popup's error message, and hide the normal UI.
 */
function reportExecuteScriptError(error) {
    document.querySelector("#popup-content").classList.add("hidden");
    document.querySelector("#error-content").classList.remove("hidden");
    console.error(`Failed to execute beastify content script: ${error}`);
}
