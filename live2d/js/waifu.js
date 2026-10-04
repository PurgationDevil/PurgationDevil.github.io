String.prototype.render = function (context) {
    var tokenReg = /(\\)?\{([^\{\}\\]+)(\\)?\}/g;

    return this.replace(tokenReg, function (word, slash1, token, slash2) {
        if (slash1 || slash2) {
            return word.replace('\\', '');
        }

        var variables = token.replace(/\s/g, '').split('.');
        var currentObject = context;
        var i, length, variable;

        for (i = 0, length = variables.length; i < length; ++i) {
            variable = variables[i];
            currentObject = currentObject[variable];
            if (currentObject === undefined || currentObject === null) return '';
        }
        return currentObject;
    });
};

var re = /x/;
console.log(re);
re.toString = function() {
    showMessage('哈哈，你打开了控制台，是想要看看我的秘密吗？', 5000, true);
    return '';
};

$(document).on('copy', function (e){
    var target = e.target || e.srcElement;
    if (target && (target.closest('.copy-btn') || target.closest('.highlight'))) {
        return;
    }
    showMessage('你都复制了些什么呀，转载要记得加上出处哦', 5000, true);
});

function initTips() {
    $.ajax({
        cache: false,
        url: "/live2d/message.json?" + new Date().getTime(),
        dataType: "json",
        success: function (result) {
            $.each(result.mouseover, function (index, tips) {
                $(document).on("mouseover", tips.selector, function () {
                    var text = tips.text;
                    if (Array.isArray(tips.text)) text = tips.text[Math.floor(Math.random() * tips.text.length + 1) - 1];
                    text = text.render({text: $(this).text()});
                    showMessage(text, 3000);
                });
            });
            $.each(result.click, function (index, tips) {
                $(document).on("click", tips.selector, function () {
                    var text = tips.text;
                    if (Array.isArray(tips.text)) {
                        text = tips.text[Math.floor(Math.random() * tips.text.length)];
                    }
                    if (text && text.indexOf('{text}') !== -1) {
                        text = text.render({text: $(this).text() || '这里'});
                    }
                    showMessage(text, 3000, true);
                });
            });
            $.each(result.seasons, function (index, tips) {
                var now = new Date();
                var after = tips.date.split('-')[0];
                var before = tips.date.split('-')[1] || after;

                if ((after.split('/')[0] <= now.getMonth() + 1 && now.getMonth() + 1 <= before.split('/')[0]) &&
                    (after.split('/')[1] <= now.getDate() && now.getDate() <= before.split('/')[1])) {
                    var text = tips.text;
                    if (Array.isArray(tips.text)) text = tips.text[Math.floor(Math.random() * text.length + 1) - 1];
                    text = text.render({year: now.getFullYear()});
                    showMessage(text, 6000, true);
                }
            });
        }
    });
}
initTips();

(function (){
    var text;
    var now = (new Date()).getHours();
    if (now > 23 || now <= 5) {
        text = '你是夜猫子呀？这么晚还不睡觉，明天起的来嘛';
    } else if (now > 5 && now <= 7) {
        text = '早上好！一日之计在于晨，美好的一天就要开始了';
    } else if (now > 7 && now <= 11) {
        text = '上午好！工作顺利嘛，不要久坐，多起来走动走动哦！';
    } else if (now > 11 && now <= 14) {
        text = '中午了，工作了一个上午，现在是午餐时间！';
    } else if (now > 14 && now <= 17) {
        text = '午后很容易犯困呢，今天的运动目标完成了吗？';
    } else if (now > 17 && now <= 19) {
        text = '傍晚了！窗外夕阳的景色很美丽呢，最美不过夕阳红~';
    } else if (now > 19 && now <= 21) {
        text = '晚上好，今天过得怎么样？';
    } else if (now > 21 && now <= 23) {
        text = '已经这么晚了呀，早点休息吧，晚安~';
    } else {
        text = '嗨~ 快来逗我玩吧！';
    }
    showMessage(text, 6000);
})();

window.hitokotoTimer = null;
startHitokotoTimer();

function showHitokoto() {
    $.getJSON("https://v1.hitokoto.cn/", function (result) {
        showMessage(result.hitokoto, 10000);
    });
}
var hideTimer = null;
function showMessage(text, timeout, flag){
    if(Array.isArray(text)) text = text[Math.floor(Math.random() * text.length + 1)-1];
    if(flag) sessionStorage.setItem('waifu-text', text);
    $('.waifu-tips').stop();
    $('.waifu-tips').html(text).fadeTo(200, 1);
    if (timeout === null) timeout = 5000;
    hideMessage(timeout);
}
function hideMessage(timeout){
    $('.waifu-tips').stop().css('opacity',1);
    if (timeout === null) timeout = 5000;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function() {
        sessionStorage.removeItem('waifu-text');
        $('.waifu-tips').fadeTo(200, 0);
    }, timeout);
}
function initLive2d() {
    $('.hide-button').fadeOut(0).on('click', () => {
        $('#landlord').css('display', 'none')
    })
    $('#landlord').hover(() => {
        $('.hide-button').fadeIn(600)
    }, () => {
        $('.hide-button').fadeOut(600)
    })
}

initLive2d();

/* ---------- 标签页后台/前台管理 ----------
 * 后台时：暂停一言轮询、粒子背景、看板娘渲染，让标签页可以深度休眠；
 * 前台时：两个动画错峰恢复，避开浏览器解冻瞬间合成层集中重建造成的卡顿。
 */
function startHitokotoTimer() {
    if (window.hitokotoTimer) clearInterval(window.hitokotoTimer);
    window.hitokotoTimer = window.setInterval(showHitokoto, 60000);
}

function setParticlesRunning(run) {
    try {
        var inst = window.pJSDom && window.pJSDom[0] && window.pJSDom[0].pJS;
        if (!inst || !inst.fn) return;
        if (run) {
            // 已有动画句柄说明还在运行，避免重复启动循环
            if (inst.fn.drawAnimFrame) return;
            if (inst.fn.vendors && typeof inst.fn.vendors.draw === 'function') {
                inst.fn.vendors.draw();
            }
        } else if (window.cancelAnimationFrame && inst.fn.drawAnimFrame) {
            window.cancelAnimationFrame(inst.fn.drawAnimFrame);
            inst.fn.drawAnimFrame = null;
        }
    } catch (e) {}
}

var particlesResumeTimer = null;
var live2dResumeTimer = null;

document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        if (window.hitokotoTimer) {
            clearInterval(window.hitokotoTimer);
            window.hitokotoTimer = null;
        }
        if (particlesResumeTimer) { clearTimeout(particlesResumeTimer); particlesResumeTimer = null; }
        if (live2dResumeTimer) { clearTimeout(live2dResumeTimer); live2dResumeTimer = null; }
        setParticlesRunning(false);
        window.__live2dPaused = true;
    } else {
        // 错峰恢复：粒子 300ms、看板娘 600ms，削平解冻瞬间的渲染高峰
        particlesResumeTimer = setTimeout(function () {
            setParticlesRunning(true);
            particlesResumeTimer = null;
        }, 300);
        live2dResumeTimer = setTimeout(function () {
            window.__live2dPaused = false;
            live2dResumeTimer = null;
        }, 600);
        if (!window.hitokotoTimer) startHitokotoTimer();
    }
});
