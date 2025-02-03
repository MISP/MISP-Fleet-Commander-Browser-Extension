if (typeof browser === "undefined") {
    var browser = chrome;
}

function saveOptions(e) {
    e.preventDefault();

    const url = document.getElementById("url").value
    const token = document.getElementById("token").value
    const notify_if_server_not_found = document.getElementById("notify_if_server_not_found").checked
    browser.storage.local.set({
        MFM_baseurl: url,
        MFM_token: token,
        MFM_notify_if_server_not_found: notify_if_server_not_found,
    }, () => {
        const status = document.getElementById('status');
        status.style.display = 'block';
        status.textContent = 'Options saved.';
        setTimeout(() => {
            status.style.display = 'none';
        }, 5000);

    });
}

function restoreOptions() {

    browser.storage.local.get().then((settings) => {
        document.getElementById("url").value = settings.MFM_baseurl || "";
        document.getElementById("token").value = settings.MFM_token || "";
        document.getElementById("notify_if_server_not_found").checked = settings.MFM_notify_if_server_not_found || false;
    })
}

if(chrome.storage) {
    document.addEventListener("DOMContentLoaded", restoreOptions);
    document.querySelector("form").addEventListener("submit", saveOptions);
} else {
    console.warn("chrome.storage is not accessible, check permissions");
}
