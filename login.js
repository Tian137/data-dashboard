(function () {
    var loginForm = document.getElementById("loginForm");
    var usernameInput = document.getElementById("loginUsername");
    var passwordInput = document.getElementById("loginPassword");
    var loginError = document.getElementById("loginError");
    var loginSubmit = document.getElementById("loginSubmit");
    var togglePasswordButton = document.getElementById("togglePasswordButton");
    var nextTarget = window.DataDashboardAuth.getNextTarget("./dashboard.html");

    if (!loginForm || !usernameInput || !passwordInput) {
        return;
    }

    var characterRefs = {
        purple: document.getElementById("charPurple"),
        black: document.getElementById("charBlack"),
        orange: document.getElementById("charOrange"),
        yellow: document.getElementById("charYellow"),
        purpleEyes: document.getElementById("purpleEyes"),
        blackEyes: document.getElementById("blackEyes"),
        orangeEyes: document.getElementById("orangeEyes"),
        yellowEyes: document.getElementById("yellowEyes"),
        purpleEyeLeft: document.getElementById("purpleEyeLeft"),
        purpleEyeRight: document.getElementById("purpleEyeRight"),
        blackEyeLeft: document.getElementById("blackEyeLeft"),
        blackEyeRight: document.getElementById("blackEyeRight"),
        purplePupilLeft: document.getElementById("purplePupilLeft"),
        purplePupilRight: document.getElementById("purplePupilRight"),
        blackPupilLeft: document.getElementById("blackPupilLeft"),
        blackPupilRight: document.getElementById("blackPupilRight"),
        orangeEyeLeft: document.getElementById("orangeEyeLeft"),
        orangeEyeRight: document.getElementById("orangeEyeRight"),
        yellowEyeLeft: document.getElementById("yellowEyeLeft"),
        yellowEyeRight: document.getElementById("yellowEyeRight"),
        yellowMouth: document.getElementById("yellowMouth")
    };

    var isSubmitting = false;
    var mouseX = window.innerWidth / 2;
    var mouseY = window.innerHeight / 2;
    var isTyping = false;
    var isLookingAtEachOther = false;
    var isPurpleBlinking = false;
    var isBlackBlinking = false;
    var isPurplePeeking = false;
    var lookTimer = 0;
    var purpleBlinkTimer = 0;
    var blackBlinkTimer = 0;
    var purplePeekTimer = 0;
    var purplePeekEndTimer = 0;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function showError(message) {
        loginError.hidden = false;
        loginError.textContent = message;
    }

    function clearError() {
        loginError.hidden = true;
        loginError.textContent = "";
    }

    function isShowingPassword() {
        return passwordInput.type === "text" && passwordInput.value.trim().length > 0;
    }

    function isHidingPassword() {
        return passwordInput.type === "password" && passwordInput.value.trim().length > 0;
    }

    function syncBodyState() {
        document.body.classList.toggle("is-auth-typing", isTyping);
        document.body.classList.toggle("auth-show-password", isShowingPassword());
    }

    function calculatePosition(element) {
        if (!element) {
            return { faceX: 0, faceY: 0, bodySkew: 0 };
        }

        var rect = element.getBoundingClientRect();
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 3;
        var deltaX = mouseX - centerX;
        var deltaY = mouseY - centerY;

        return {
            faceX: clamp(deltaX / 20, -15, 15),
            faceY: clamp(deltaY / 30, -10, 10),
            bodySkew: clamp(-deltaX / 120, -6, 6)
        };
    }

    function calculatePupilOffset(element, maxDistance, forceX, forceY) {
        if (!element) {
            return { x: 0, y: 0 };
        }

        if (typeof forceX === "number" && typeof forceY === "number") {
            return { x: forceX, y: forceY };
        }

        var rect = element.getBoundingClientRect();
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;
        var deltaX = mouseX - centerX;
        var deltaY = mouseY - centerY;
        var distance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), maxDistance);
        var angle = Math.atan2(deltaY, deltaX);

        return {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance
        };
    }

    function setBlink(eyeElement, blinking) {
        eyeElement.classList.toggle("is-blinking", blinking);
    }

    function setPupilTransform(eyeElement, pupilElement, maxDistance, forceX, forceY) {
        var offset = calculatePupilOffset(eyeElement, maxDistance, forceX, forceY);
        pupilElement.style.transform = "translate(" + offset.x.toFixed(2) + "px, " + offset.y.toFixed(2) + "px)";
    }

    function setDotTransform(dotElement, maxDistance, forceX, forceY) {
        var offset = calculatePupilOffset(dotElement, maxDistance, forceX, forceY);
        dotElement.style.transform = "translate(" + offset.x.toFixed(2) + "px, " + offset.y.toFixed(2) + "px)";
    }

    function renderCharacters() {
        var showingPassword = isShowingPassword();
        var hidingPassword = isHidingPassword();

        var purplePos = calculatePosition(characterRefs.purple);
        var blackPos = calculatePosition(characterRefs.black);
        var orangePos = calculatePosition(characterRefs.orange);
        var yellowPos = calculatePosition(characterRefs.yellow);

        characterRefs.purple.style.height = (isTyping || hidingPassword) ? "272px" : "248px";
        characterRefs.purple.style.transform = showingPassword
            ? "skewX(0deg)"
            : (isTyping || hidingPassword)
                ? "skewX(" + (purplePos.bodySkew - 12).toFixed(2) + "deg) translateX(34px)"
                : "skewX(" + purplePos.bodySkew.toFixed(2) + "deg)";

        characterRefs.black.style.transform = showingPassword
            ? "skewX(0deg)"
            : isLookingAtEachOther
                ? "skewX(" + (blackPos.bodySkew * 1.5 + 10).toFixed(2) + "deg) translateX(18px)"
                : (isTyping || hidingPassword)
                    ? "skewX(" + (blackPos.bodySkew * 1.5).toFixed(2) + "deg)"
                    : "skewX(" + blackPos.bodySkew.toFixed(2) + "deg)";

        characterRefs.orange.style.transform = showingPassword
            ? "skewX(0deg)"
            : "skewX(" + orangePos.bodySkew.toFixed(2) + "deg)";

        characterRefs.yellow.style.transform = showingPassword
            ? "skewX(0deg)"
            : "skewX(" + yellowPos.bodySkew.toFixed(2) + "deg)";

        characterRefs.purpleEyes.style.left = (showingPassword ? 13 : (isLookingAtEachOther ? 36 : 29 + purplePos.faceX)).toFixed(2) + "px";
        characterRefs.purpleEyes.style.top = (showingPassword ? 23 : (isLookingAtEachOther ? 42 : 25 + purplePos.faceY)).toFixed(2) + "px";

        characterRefs.blackEyes.style.left = (showingPassword ? 7 : (isLookingAtEachOther ? 21 : 17 + blackPos.faceX)).toFixed(2) + "px";
        characterRefs.blackEyes.style.top = (showingPassword ? 18 : (isLookingAtEachOther ? 8 : 21 + blackPos.faceY)).toFixed(2) + "px";

        characterRefs.orangeEyes.style.left = (showingPassword ? 31 : 51 + orangePos.faceX).toFixed(2) + "px";
        characterRefs.orangeEyes.style.top = (showingPassword ? 53 : 56 + orangePos.faceY).toFixed(2) + "px";

        characterRefs.yellowEyes.style.left = (showingPassword ? 12 : 32 + yellowPos.faceX).toFixed(2) + "px";
        characterRefs.yellowEyes.style.top = (showingPassword ? 22 : 26 + yellowPos.faceY).toFixed(2) + "px";

        characterRefs.yellowMouth.style.left = (showingPassword ? 15 : 24 + yellowPos.faceX).toFixed(2) + "px";
        characterRefs.yellowMouth.style.top = (showingPassword ? 57 : 57 + yellowPos.faceY).toFixed(2) + "px";

        setBlink(characterRefs.purpleEyeLeft, isPurpleBlinking);
        setBlink(characterRefs.purpleEyeRight, isPurpleBlinking);
        setBlink(characterRefs.blackEyeLeft, isBlackBlinking);
        setBlink(characterRefs.blackEyeRight, isBlackBlinking);

        setPupilTransform(characterRefs.purpleEyeLeft, characterRefs.purplePupilLeft, 4, showingPassword ? (isPurplePeeking ? 4 : -4) : (isLookingAtEachOther ? 3 : undefined), showingPassword ? (isPurplePeeking ? 5 : -4) : (isLookingAtEachOther ? 4 : undefined));
        setPupilTransform(characterRefs.purpleEyeRight, characterRefs.purplePupilRight, 4, showingPassword ? (isPurplePeeking ? 4 : -4) : (isLookingAtEachOther ? 3 : undefined), showingPassword ? (isPurplePeeking ? 5 : -4) : (isLookingAtEachOther ? 4 : undefined));
        setPupilTransform(characterRefs.blackEyeLeft, characterRefs.blackPupilLeft, 4, showingPassword ? -4 : (isLookingAtEachOther ? 0 : undefined), showingPassword ? -4 : (isLookingAtEachOther ? -4 : undefined));
        setPupilTransform(characterRefs.blackEyeRight, characterRefs.blackPupilRight, 4, showingPassword ? -4 : (isLookingAtEachOther ? 0 : undefined), showingPassword ? -4 : (isLookingAtEachOther ? -4 : undefined));

        setDotTransform(characterRefs.orangeEyeLeft, 4, showingPassword ? -5 : undefined, showingPassword ? -4 : undefined);
        setDotTransform(characterRefs.orangeEyeRight, 4, showingPassword ? -5 : undefined, showingPassword ? -4 : undefined);
        setDotTransform(characterRefs.yellowEyeLeft, 4, showingPassword ? -5 : undefined, showingPassword ? -4 : undefined);
        setDotTransform(characterRefs.yellowEyeRight, 4, showingPassword ? -5 : undefined, showingPassword ? -4 : undefined);
        syncBodyState();
    }

    function scheduleBlink(color) {
        var timerId = window.setTimeout(function () {
            if (color === "purple") {
                isPurpleBlinking = true;
                renderCharacters();
                window.setTimeout(function () {
                    isPurpleBlinking = false;
                    renderCharacters();
                    scheduleBlink("purple");
                }, 150);
            } else {
                isBlackBlinking = true;
                renderCharacters();
                window.setTimeout(function () {
                    isBlackBlinking = false;
                    renderCharacters();
                    scheduleBlink("black");
                }, 150);
            }
        }, Math.random() * 4000 + 3000);

        if (color === "purple") {
            purpleBlinkTimer = timerId;
        } else {
            blackBlinkTimer = timerId;
        }
    }

    function resetPeekLoop() {
        window.clearTimeout(purplePeekTimer);
        window.clearTimeout(purplePeekEndTimer);
        isPurplePeeking = false;

        if (!isShowingPassword()) {
            renderCharacters();
            return;
        }

        function schedulePeek() {
            purplePeekTimer = window.setTimeout(function () {
                isPurplePeeking = true;
                renderCharacters();
                purplePeekEndTimer = window.setTimeout(function () {
                    isPurplePeeking = false;
                    renderCharacters();
                    schedulePeek();
                }, 800);
            }, Math.random() * 3000 + 2000);
        }

        schedulePeek();
    }

    function triggerLookAtEachOther() {
        window.clearTimeout(lookTimer);
        isLookingAtEachOther = true;
        renderCharacters();
        lookTimer = window.setTimeout(function () {
            isLookingAtEachOther = false;
            renderCharacters();
        }, 800);
    }

    function setTypingState(active) {
        var nextValue = Boolean(active);
        if (nextValue && !isTyping) {
            triggerLookAtEachOther();
        }
        isTyping = nextValue;
        syncBodyState();
        renderCharacters();
    }

    function syncTypingFromFocus() {
        setTypingState(document.activeElement === usernameInput);
    }

    usernameInput.addEventListener("focus", function () {
        setTypingState(true);
    });

    usernameInput.addEventListener("blur", function () {
        window.setTimeout(syncTypingFromFocus, 0);
    });

    usernameInput.addEventListener("input", renderCharacters);
    passwordInput.addEventListener("input", function () {
        renderCharacters();
        resetPeekLoop();
    });

    togglePasswordButton.addEventListener("click", function () {
        var reveal = passwordInput.type === "password";
        passwordInput.type = reveal ? "text" : "password";
        togglePasswordButton.textContent = reveal ? "隐藏" : "显示";
        passwordInput.focus();
        renderCharacters();
        resetPeekLoop();
    });

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (isSubmitting) {
            return;
        }

        var username = usernameInput.value.trim();
        var password = passwordInput.value.trim();
        clearError();

        if (!username) {
            showError("请输入邮箱后再登录。");
            usernameInput.focus();
            return;
        }

        if (!password) {
            showError("请输入密码后再登录。");
            passwordInput.focus();
            return;
        }

        isSubmitting = true;
        loginSubmit.disabled = true;
        loginSubmit.textContent = "登录中...";

        try {
            await window.DataDashboardAuth.login(username, password);
            window.location.replace(nextTarget);
        } catch (error) {
            showError(error && error.message ? error.message : "登录失败，请稍后重试。");
            isSubmitting = false;
            loginSubmit.disabled = false;
            loginSubmit.textContent = "登录";
        }
    });

    window.addEventListener("mousemove", function (event) {
        mouseX = event.clientX;
        mouseY = event.clientY;
        renderCharacters();
    });

    window.addEventListener("resize", renderCharacters);
    window.addEventListener("beforeunload", function () {
        window.clearTimeout(lookTimer);
        window.clearTimeout(purpleBlinkTimer);
        window.clearTimeout(blackBlinkTimer);
        window.clearTimeout(purplePeekTimer);
        window.clearTimeout(purplePeekEndTimer);
    });

    scheduleBlink("purple");
    scheduleBlink("black");
    syncBodyState();
    renderCharacters();
})();
