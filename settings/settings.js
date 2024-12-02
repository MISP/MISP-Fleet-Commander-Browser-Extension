if (typeof browser === "undefined") {
    var browser = chrome;
}
// jtYjib_C8SrFpEIuDNa98RlkwpXK_LSi6XjM7WBxjT6GHYR9EzRrKQ
function saveOptions(e) {
    e.preventDefault();

    const url = document.getElementById("url").value
    const token = document.getElementById("token").value
    browser.storage.local.set({
        MFM_baseurl: url,
        MFM_token: token,
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
        console.log(settings);
        document.getElementById("url").value = settings.MFM_baseurl || "";
        document.getElementById("token").value = settings.MFM_token || "";
    })
}

if(chrome.storage) {
    document.addEventListener("DOMContentLoaded", restoreOptions);
    document.querySelector("form").addEventListener("submit", saveOptions);
} else {
    console.warn("chrome.storage is not accessible, check permissions");
}
