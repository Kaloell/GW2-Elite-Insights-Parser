/*jshint esversion: 6 */
// const images
const deadIcon = new Image();
deadIcon.onload = function () {
    animateCanvas(-1);
};
const downIcon = new Image();
downIcon.onload = function () {
    animateCanvas(-1);
};
const dcIcon = new Image();
dcIcon.onload = function () {
    animateCanvas(-1);
};
const facingIcon = new Image();
facingIcon.onload = function () {
    animateCanvas(-1);
};

const resolutionMultiplier = window.devicePixelRatio;

var animator = null;

class Animator {
    constructor(options, reactiveData) {
        var _this = this;
        // status
        this.reactiveDataStatus = reactiveData;
        // time
        this.prevTime = 0;
        this.times = [];
        // simulation params
        this.inch = 10;
        this.pollingRate = 150;
        this.speed = 1;
        this.backwards = false;
        this.rangeControl = new Set();
        this.selectedGroup = -1;
        // actors
        this.targetData = new Map();
        this.playerData = new Map();
        this.trashMobData = new Map();
        this.mechanicActorData = [];
        this.attachedActorData = new Map();
        this.backgroundActorData = [];
        this.backgroundImages = [];
        // animation
        this.needBGUpdate = false;
        this.prevBGImage = null;
        this.animation = null;
        this.timeSlider = document.getElementById('timeRange');
        this.timeSliderDisplay = document.getElementById('timeRangeDisplay');
        // main canvas
        this.mainCanvas = document.getElementById('main-canvas');
        this.mainCanvas.style.width = this.mainCanvas.width + "px";
        this.mainCanvas.style.height = this.mainCanvas.height + "px";
        this.mainCanvas.width *= resolutionMultiplier;
        this.mainCanvas.height *= resolutionMultiplier;
        this.mainContext = this.mainCanvas.getContext('2d');
        this.mainContext.imageSmoothingEnabled = true;
        // bg canvas
        this.bgCanvas = document.getElementById('bg-canvas');
        this.bgCanvas.style.width = this.bgCanvas.width + "px";
        this.bgCanvas.style.height = this.bgCanvas.height + "px";
        this.bgCanvas.width *= resolutionMultiplier;
        this.bgCanvas.height *= resolutionMultiplier;
        this.bgContext = this.bgCanvas.getContext('2d');
        this.bgContext.imageSmoothingEnabled = true;
        // manipulation
        this.lastX = this.mainCanvas.width / 2;
        this.lastY = this.mainCanvas.height / 2;
        this.dragStart = null;
        this.dragged = false;
        this.scale = 1.0;
        if (options) {
            if (options.inch) this.inch = options.inch;
            if (options.pollingRate) this.pollingRate = options.pollingRate;
            if (options.maps) {
                for (var i = 0; i < options.maps.length; i++) {
                    var mapData = options.maps[i];
                    var image = new Image();
                    image.onload = function () {
                        _this.needBGUpdate = true;
                        animateCanvas(-1);
                    };
                    image.src = mapData.link;
                    this.backgroundImages.push({
                        image: image,
                        start: mapData.start,
                        end: mapData.end
                    });
                }
            }
            if (options.actors) this.initActors(options.actors);
            downIcon.src = "https://wiki.guildwars2.com/images/c/c6/Downed_enemy.png";
            dcIcon.src = "https://wiki.guildwars2.com/images/f/f5/Talk_end_option_tango.png";
            deadIcon.src = "https://wiki.guildwars2.com/images/4/4a/Ally_death_%28interface%29.png";
            facingIcon.src = "https://i.imgur.com/tZTmTRn.png";
        }
        //
        this.trackTransforms(this.mainContext);
        this.trackTransforms(this.bgContext);
        this.mainContext.scale(resolutionMultiplier, resolutionMultiplier);
        this.bgContext.scale(resolutionMultiplier, resolutionMultiplier);
        this.initMouseEvents();
        this.initTouchEvents();
    }

    initActors(actors) {
        this.playerData.clear();
        this.targetData.clear();
        this.trashMobData.clear();
        this.attachedActorData.clear();
        this.mechanicActorData = [];
        for (let i = 0; i < actors.length; i++) {
            const actor = actors[i];
            switch (actor.type) {
                case "Player":
                    this.playerData.set(actor.id, new PlayerIconDrawable(actor.img, 20, actor.group, actor.positions, actor.dead, actor.down, actor.dc, this, actor));
                    if (this.times.length === 0) {
                        for (let j = 0; j < actor.positions.length / 2; j++) {
                            this.times.push(j * this.pollingRate);
                        }
                    }
                    break;
                case "Target":
                    this.targetData.set(actor.id, new EnemyIconDrawable(actor.start, actor.end, actor.img, 30, actor.positions));
                    break;
                case "Mob":
                    this.trashMobData.set(actor.id, new EnemyIconDrawable(actor.start, actor.end, actor.img, 25, actor.positions));
                    break;
                case "Circle":
                    this.mechanicActorData.push(new CircleMechanicDrawable(actor.start, actor.end, actor.fill, actor.growing, actor.color, this.inch * actor.radius, actor.connectedTo, this.inch * actor.minRadius));
                    break;
                case "Rectangle":
                    this.mechanicActorData.push(new RectangleMechanicDrawable(actor.start, actor.end, actor.fill, actor.growing, actor.color, this.inch * actor.width, this.inch * actor.height, actor.connectedTo));
                    break;
                case "RotatedRectangle":
                    this.mechanicActorData.push(new RotatedRectangleMechanicDrawable(actor.start, actor.end, actor.fill, actor.growing, actor.color, this.inch * actor.width, this.inch * actor.height, actor.rotation, this.inch * actor.radialTranslation, actor.spinAngle, actor.connectedTo));
                    break;
                case "Doughnut":
                    this.mechanicActorData.push(new DoughnutMechanicDrawable(actor.start, actor.end, actor.fill, actor.growing, actor.color, this.inch * actor.innerRadius, this.inch * actor.outerRadius, actor.connectedTo));
                    break;
                case "Pie":
                    this.mechanicActorData.push(new PieMechanicDrawable(actor.start, actor.end, actor.fill, actor.growing, actor.color, actor.direction, actor.openingAngle, this.inch * actor.radius, actor.connectedTo));
                    break;
                case "Line":
                    this.mechanicActorData.push(new LineMechanicDrawable(actor.start, actor.end, actor.fill, actor.growing, actor.color, actor.connectedFrom, actor.connectedTo));
                    break;
                case "Facing":
                    this.attachedActorData.set(actor.connectedTo, new FacingMechanicDrawable(actor.start, actor.end, actor.connectedTo, actor.facingData));
                    break;
                case "FacingRectangle":
                    this.attachedActorData.set(actor.connectedTo, new FacingRectangleMechanicDrawable(actor.start, actor.end, actor.connectedTo, actor.facingData, this.inch * actor.width, this.inch * actor.height, actor.color));
                    break;
                case "MovingPlatform":
                    this.backgroundActorData.push(new MovingPlatformDrawable(actor.start, actor.end, actor.image, actor.width, actor.height, actor.positions));
                    break;
            }
        }
    }

    updateTime(value) {
        this.reactiveDataStatus.time = parseInt(value);
        if (this.animation === null) {
            animateCanvas(-1);
        }
    }

    updateTextInput() {
        this.timeSliderDisplay.value = (this.reactiveDataStatus.time / 1000.0).toFixed(3);
    }

    updateInputTime(value) {
        try {
            const cleanedString = value.replace(",", ".");
            const parsedTime = parseFloat(cleanedString);
            if (isNaN(parsedTime)) {
                return;
            }
            const ms = Math.round(parsedTime * 1000.0);
            this.reactiveDataStatus.time = Math.min(Math.max(ms, 0), this.times[this.times.length - 1]);
            animateCanvas(-2);
        } catch (error) {
            console.error(error);
        }
    }

    toggleAnimate() {
        if (!this.startAnimate(true)) {
            this.stopAnimate(true);
        }
    }

    startAnimate(updateReactiveStatus) {
        if (this.animation === null && this.times.length > 0) {
            if (this.reactiveDataStatus.time >= this.times[this.times.length - 1]) {
                this.reactiveDataStatus.time = 0;
            }
            this.prevTime = new Date().getTime();
            this.animation = requestAnimationFrame(animateCanvas);
            if (updateReactiveStatus) {
                this.reactiveDataStatus.animated = true;
            }
            return true;
        }
        return false;
    }

    stopAnimate(updateReactiveStatus) {
        if (this.animation !== null) {
            window.cancelAnimationFrame(this.animation);
            this.animation = null;
            if (updateReactiveStatus) {
                this.reactiveDataStatus.animated = false;
            }
            return true;
        }
        return false;
    }

    restartAnimate() {
        this.reactiveDataStatus.time = 0;
        if (this.animation === null) {
            animateCanvas(-1);
        }
    }

    selectActor(pId) {
        let actor = this.playerData.get(pId);
        this.reactiveDataStatus.selectedPlayer = null;
        this.reactiveDataStatus.selectedPlayerID = null;
        let oldSelect = actor.selected;
        this.playerData.forEach(function (value, key, map) {
            value.selected = false;
        });
        actor.selected = !oldSelect;
        this.selectedGroup = actor.selected ? actor.group : -1;
        if (actor.selected) {
            this.reactiveDataStatus.selectedPlayer = actor;
            this.reactiveDataStatus.selectedPlayerID = pId;
        }
        if (this.animation === null) {
            animateCanvas(-1);
        }
    }

    initMouseEvents() {
        var _this = this;
        var canvas = this.mainCanvas;
        var ctx = this.mainContext;
        var bgCtx = this.bgContext;

        canvas.addEventListener('dblclick', function (evt) {
            _this.lastX = canvas.width / 2;
            _this.lastY = canvas.height / 2;
            _this.dragStart = null;
            _this.dragged = false;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(resolutionMultiplier, resolutionMultiplier);
            bgCtx.setTransform(1, 0, 0, 1, 0, 0);
            bgCtx.scale(resolutionMultiplier, resolutionMultiplier);
            _this.needBGUpdate = true;
            if (_this.animation === null) {
                animateCanvas(-1);
            }
        }, false);

        canvas.addEventListener('mousedown', function (evt) {
            _this.lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
            _this.lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
            _this.dragStart = ctx.transformedPoint(_this.lastX, _this.lastY);
            _this.dragged = false;
        }, false);

        canvas.addEventListener('mousemove', function (evt) {
            _this.lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
            _this.lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
            _this.dragged = true;
            if (_this.dragStart) {
                var pt = ctx.transformedPoint(_this.lastX, _this.lastY);
                ctx.translate(pt.x - _this.dragStart.x, pt.y - _this.dragStart.y);
                bgCtx.translate(pt.x - _this.dragStart.x, pt.y - _this.dragStart.y);
                _this.needBGUpdate = true;
                if (_this.animation === null) {
                    animateCanvas(-1);
                }
            }
        }, false);

        document.body.addEventListener('mouseup', function (evt) {
            _this.dragStart = null;
        }, false);

        var zoom = function (evt) {
            var delta = evt.wheelDelta ? evt.wheelDelta / 40 : evt.detail ? -evt.detail : 0;
            if (delta) {
                var pt = ctx.transformedPoint(_this.lastX, _this.lastY);
                ctx.translate(pt.x, pt.y);
                bgCtx.translate(pt.x, pt.y);
                var factor = Math.pow(1.1, delta);
                ctx.scale(factor, factor);
                ctx.translate(-pt.x, -pt.y);
                bgCtx.scale(factor, factor);
                bgCtx.translate(-pt.x, -pt.y);
                _this.needBGUpdate = true;
                if (_this.animation === null) {
                    animateCanvas(-1);
                }
            }
            return evt.preventDefault() && false;
        };

        canvas.addEventListener('DOMMouseScroll', zoom, false);
        canvas.addEventListener('mousewheel', zoom, false);
    }

    initTouchEvents() {
        // todo
    }

    setSpeed(value) {
        this.speed = value;
    }

    getSpeed() {
        if (this.backwards) {
            return -this.speed;
        }
        return this.speed;
    }

    toggleBackwards() {
        this.backwards = !this.backwards;
        return this.backwards;
    }

    toggleRange(radius) {
        var active;
        if (this.rangeControl.has(radius)) {
            this.rangeControl.delete(radius);
            active = false;
        } else {
            this.rangeControl.add(radius);
            active = true;
        }
        if (this.animation === null) {
            animateCanvas(-1);
        }
        return active;
    }

    // https://codepen.io/anon/pen/KrExzG
    trackTransforms(ctx) {
        var svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
        var xform = svg.createSVGMatrix();
        ctx.getTransform = function () {
            return xform;
        };

        var savedTransforms = [];
        var save = ctx.save;
        ctx.save = function () {
            savedTransforms.push(xform.translate(0, 0));
            return save.call(ctx);
        };

        var restore = ctx.restore;
        ctx.restore = function () {
            xform = savedTransforms.pop();
            return restore.call(ctx);
        };

        var scale = ctx.scale;
        var _this = this;
        ctx.scale = function (sx, sy) {
            xform = xform.scaleNonUniform(sx, sy);
            var xAxis = Math.sqrt(xform.a * xform.a + xform.b * xform.b);
            var yAxis = Math.sqrt(xform.c * xform.c + xform.d * xform.d);
            _this.scale = Math.max(xAxis, yAxis) / resolutionMultiplier;
            return scale.call(ctx, sx, sy);
        };

        var rotate = ctx.rotate;
        ctx.rotate = function (radians) {
            xform = xform.rotate(radians * 180 / Math.PI);
            return rotate.call(ctx, radians);
        };

        var translate = ctx.translate;
        ctx.translate = function (dx, dy) {
            xform = xform.translate(dx, dy);
            return translate.call(ctx, dx, dy);
        };

        var transform = ctx.transform;
        ctx.transform = function (a, b, c, d, e, f) {
            var m2 = svg.createSVGMatrix();
            m2.a = a;
            m2.b = b;
            m2.c = c;
            m2.d = d;
            m2.e = e;
            m2.f = f;
            xform = xform.multiply(m2);
            return transform.call(ctx, a, b, c, d, e, f);
        };

        var setTransform = ctx.setTransform;
        ctx.setTransform = function (a, b, c, d, e, f) {
            xform.a = a;
            xform.b = b;
            xform.c = c;
            xform.d = d;
            xform.e = e;
            xform.f = f;
            return setTransform.call(ctx, a, b, c, d, e, f);
        };

        var pt = svg.createSVGPoint();
        ctx.transformedPoint = function (x, y) {
            pt.x = x * resolutionMultiplier;
            pt.y = y * resolutionMultiplier;
            return pt.matrixTransform(xform.inverse());
        };
    }
    // animation
    _getBackgroundImage() {
        var time = this.reactiveDataStatus.time;
        for (var i = 0; i < this.backgroundImages.length; i++) {
            var imageData = this.backgroundImages[i];
            if (imageData.start < 0 || imageData.end < 0 || (imageData.start <= time && imageData.end >= time)) {
                return imageData.image;
            }
        }
        return null;
    }

    _drawBGCanvas() {
        var imgToDraw = this._getBackgroundImage();
        if ((imgToDraw !== null && imgToDraw !== this.prevBGImage) || this.needBGUpdate) {
            this.needBGUpdate = false;
            this.prevBGImage = imgToDraw;
            var ctx = this.bgContext;
            var canvas = this.bgCanvas;
            var p1 = ctx.transformedPoint(0, 0);
            var p2 = ctx.transformedPoint(canvas.width, canvas.height);
            ctx.clearRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);

            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.restore();


            ctx.drawImage(this._getBackgroundImage(), 0, 0, canvas.width / resolutionMultiplier, canvas.height / resolutionMultiplier);

            //ctx.globalCompositeOperation = "color-burn";
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            // draw scale
            ctx.lineWidth = 3 * resolutionMultiplier;
            ctx.strokeStyle = "red";
            var pos = resolutionMultiplier * 70;
            var width = resolutionMultiplier * 50;
            var height = resolutionMultiplier * 6;
            // main line
            ctx.beginPath();
            ctx.moveTo(pos, pos);
            ctx.lineTo(pos + width, pos);
            ctx.stroke();
            ctx.lineWidth = resolutionMultiplier;
            // right border
            ctx.beginPath();
            ctx.moveTo(pos - resolutionMultiplier, pos + height);
            ctx.lineTo(pos - resolutionMultiplier, pos - height);
            ctx.stroke();
            // left border
            ctx.beginPath();
            ctx.moveTo(pos + width + resolutionMultiplier, pos + height);
            ctx.lineTo(pos + width + resolutionMultiplier, pos - height);
            ctx.stroke();
            // text
            var fontSize = 13 * resolutionMultiplier;
            ctx.font = fontSize + "px Comic Sans MS";
            ctx.fillStyle = "red";
            ctx.textAlign = "center";
            ctx.fillText((50 / (this.inch * this.scale)).toFixed(1) + " inches", resolutionMultiplier * 95, resolutionMultiplier * 60);
            ctx.restore();
            //ctx.globalCompositeOperation = 'normal';
        }
    }

    _drawMainCanvas() {
        var _this = this;
        var ctx = this.mainContext;
        var canvas = this.mainCanvas;
        var p1 = ctx.transformedPoint(0, 0);
        var p2 = ctx.transformedPoint(canvas.width, canvas.height);
        ctx.clearRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        // Background items commonly overlap so they need to be drawn in the correct order by height
        // This is sorted in reverse order because the z axis is inverted
        animator.backgroundActorData.sort((x, y) => y.getHeight() - x.getHeight());
        for (let i = 0; i < animator.backgroundActorData.length; i++) {
            animator.backgroundActorData[i].draw();
        }
        for (let i = 0; i < this.mechanicActorData.length; i++) {
            this.mechanicActorData[i].draw();
        }
        this.playerData.forEach(function (value, key, map) {
            if (!value.selected) {
                value.draw();
                if (_this.attachedActorData.has(key)) {
                    _this.attachedActorData.get(key).draw();
                }
            }
        });
        this.trashMobData.forEach(function (value, key, map) {
            value.draw();
            if (_this.attachedActorData.has(key)) {
                _this.attachedActorData.get(key).draw();
            }
        });
        this.targetData.forEach(function (value, key, map) {
            value.draw();
            if (_this.attachedActorData.has(key)) {
                _this.attachedActorData.get(key).draw();
            }
        });
        if (this.reactiveDataStatus.selectedPlayer !== null) {
            this.reactiveDataStatus.selectedPlayer.draw();
            if (this.attachedActorData.has(this.reactiveDataStatus.selectedPlayerID)) {
                this.attachedActorData.get(this.reactiveDataStatus.selectedPlayerID).draw();
            }
        }
    }

    draw() {
        //
        this._drawBGCanvas();
        this._drawMainCanvas();
    }
}

function animateCanvas(noRequest) {
    if (animator == null) {
        return;
    }
    let lastTime = animator.times[animator.times.length - 1];
    if (noRequest > -1 && animator.animation !== null) {
        let curTime = new Date().getTime();
        let timeOffset = curTime - animator.prevTime;
        animator.prevTime = curTime;
        animator.reactiveDataStatus.time = Math.round(Math.max(Math.min(animator.reactiveDataStatus.time + animator.getSpeed() * timeOffset, lastTime),0));
    }
    if ((animator.reactiveDataStatus.time === lastTime && !animator.backwards) || (animator.reactiveDataStatus.time === 0 && animator.backwards)) {
        animator.stopAnimate(true);
    }
    animator.timeSlider.value = animator.reactiveDataStatus.time.toString();
    if (noRequest > -2) {
        animator.updateTextInput();
    }
    animator.draw();
    if (noRequest > -1 && animator.animation !== null) {
        animator.animation = requestAnimationFrame(animateCanvas);
    }
}
/*
function initCombatReplay(actors, options) {
    // manipulation events  
    canvas.addEventListener('touchstart', function (evt) {
        var touch = evt.changedTouches[0];
        if (!touch) {
            return;
        }
        lastX = (touch.pageX - canvas.offsetLeft);
        lastY = (touch.pageY - canvas.offsetTop);
        dragStart = ctx.transformedPoint(lastX, lastY);
        dragged = false;
        return evt.preventDefault() && false;
    }, false);

    canvas.addEventListener('touchmove', function (evt) {
        var touch = evt.changedTouches[0];
        if (!touch) {
            return;
        }
        lastX = (touch.pageX - canvas.offsetLeft);
        lastY = (touch.pageY - canvas.offsetTop);
        dragged = true;
        if (dragStart) {
            var pt = ctx.transformedPoint(lastX, lastY);
            ctx.translate(pt.x - dragStart.x, pt.y - dragStart.y);
            animateCanvas(-1);
        }
        return evt.preventDefault() && false;
    }, false);
    document.body.addEventListener('touchend', function (evt) {
        dragStart = null;
    }, false);
}
*/

// Drawables
//// ACTORS
class IconDrawable {
    constructor(start, end, imgSrc, pixelSize) {
        this.pos = null;
        this.start = start;
        this.end = end;
        this.img = new Image();
        this.img.src = imgSrc;
        this.img.onload = function () {
            animateCanvas(-1);
        };
        this.pixelSize = pixelSize;
    }

    getInterpolatedPosition(startIndex, currentIndex) {
        const offsetedIndex = currentIndex - startIndex;
        const positionX = this.pos[2 * offsetedIndex];
        const positionY = this.pos[2 * offsetedIndex + 1];
        const timeValue = animator.times[currentIndex];
        var pt = {
            x: 0,
            y: 0
        };
        var time = animator.reactiveDataStatus.time;
        if (time - timeValue > 0 && offsetedIndex < 0.5 * this.pos.length - 1) {
            const nextTimeValue = animator.times[currentIndex + 1];
            const nextPositionX = this.pos[2 * offsetedIndex + 2];
            const nextPositionY = this.pos[2 * offsetedIndex + 3];
            pt.x = positionX + (time - timeValue) / (nextTimeValue - timeValue) * (nextPositionX - positionX);
            pt.y = positionY + (time - timeValue) / (nextTimeValue - timeValue) * (nextPositionY - positionY);
        } else {
            pt.x = positionX;
            pt.y = positionY;
        }
        pt.x = Math.round(10 * pt.x * animator.scale) / (10 * animator.scale);
        pt.y = Math.round(10 * pt.y * animator.scale) / (10 * animator.scale);
        return pt;
    }

    getPosition() {
        if (this.pos === null || this.pos.length === 0) {
            return null;
        }
        var time = animator.reactiveDataStatus.time;
        if (this.start !== -1 && (this.start >= time || this.end <= time)) {
            return null;
        }
        if (this.pos.length === 2) {
            return {
                x: this.pos[0],
                y: this.pos[1]
            };
        }
        const lastTime = animator.times[animator.times.length - 1];
        const startIndex = Math.ceil((animator.times.length - 1) * Math.max(this.start, 0) / lastTime);
        const currentIndex = Math.floor((animator.times.length - 1) * time / lastTime);
        return this.getInterpolatedPosition(startIndex, Math.max(currentIndex, startIndex));
    }

    draw() {
        const pos = this.getPosition();
        if (pos === null) {
            return;
        }
        const fullSize = this.pixelSize / animator.scale;
        const halfSize = fullSize / 2;
        animator.mainContext.drawImage(this.img,
            pos.x - halfSize, pos.y - halfSize, fullSize, fullSize);
    }

}

class PlayerIconDrawable extends IconDrawable {
    constructor(imgSrc, pixelSize, group, pos, dead, down, dc, animator, actor) {
        super(-1, -1, imgSrc, pixelSize);
        this.pos = pos;
        this.dead = dead;
        this.down = down;
        this.dc = dc;
        this.selected = false;
        this.group = group;
        this.animator = animator;
        this.actor = actor;
    }

    draw() {
        const pos = this.getPosition();
        if (pos === null) {
            return;
        }
        var ctx = animator.mainContext;
        const fullSize = this.pixelSize / animator.scale;
        const halfSize = fullSize / 2;
        if (!this.selected && this.group === animator.selectedGroup) {
            ctx.beginPath();
            ctx.lineWidth = (2 / animator.scale).toString();
            ctx.strokeStyle = 'blue';
            ctx.rect(pos.x - halfSize, pos.y - halfSize, fullSize, fullSize);
            ctx.stroke();
        } else if (this.selected) {
            ctx.beginPath();
            ctx.lineWidth = (4 / animator.scale).toString();
            ctx.strokeStyle = 'green';
            ctx.rect(pos.x - halfSize, pos.y - halfSize, fullSize, fullSize);
            ctx.stroke();

            const rot = this.animator.attachedActorData.get(this.actor.id).getRotation();
            const angle = rot * Math.PI / 180;
            const startAngle = angle - 0.25 * Math.PI;
            const endAngle = angle + 0.25 * Math.PI;

            animator.rangeControl.forEach(function (present, radius, set) {
                const startX = animator.inch * radius * Math.cos(startAngle) + pos.x;
                const startY = animator.inch * radius * Math.sin(startAngle) + pos.y;

                const endX = animator.inch * radius * Math.cos(endAngle) + pos.x;
                const endY = animator.inch * radius * Math.sin(endAngle) + pos.y;

                ctx.beginPath();
                ctx.strokeStyle = 'blue';
                ctx.lineWidth = (2 / animator.scale).toString();
                ctx.moveTo(pos.x, pos.y);
                ctx.lineTo(startX, startY);
                ctx.stroke();

                ctx.beginPath();
                ctx.strokeStyle = 'blue';
                ctx.lineWidth = (2 / animator.scale).toString();
                ctx.moveTo(pos.x, pos.y);
                ctx.lineTo(endX, endY);
                ctx.stroke();

                ctx.beginPath();
                ctx.lineWidth = (2 / animator.scale).toString();
                ctx.strokeStyle = 'blue';
                ctx.arc(pos.x, pos.y, animator.inch * radius, startAngle, endAngle);
                ctx.stroke();
                ctx.beginPath();
                ctx.lineWidth = (2 / animator.scale).toString();
                ctx.strokeStyle = 'green';
                ctx.arc(pos.x, pos.y, animator.inch * radius, startAngle, endAngle, true);
                ctx.stroke();
            });
        }
        ctx.drawImage(this.getIcon(),
            pos.x - halfSize, pos.y - halfSize, fullSize, fullSize);
    }

    died() {
        if (this.dead === null || this.dead.length === 0) {
            return false;
        }
        var time = animator.reactiveDataStatus.time;
        for (let i = 0; i < this.dead.length; i += 2) {
            if (this.dead[i] <= time && this.dead[i + 1] >= time) {
                return true;
            }
        }
        return false;
    }

    downed() {
        if (this.down === null || this.down.length === 0) {
            return false;
        }
        var time = animator.reactiveDataStatus.time;
        for (let i = 0; i < this.down.length; i += 2) {
            if (this.down[i] <= time && this.down[i + 1] >= time) {
                return true;
            }
        }
        return false;
    }

    disconnected() {
        if (this.dc === null || this.dc.length === 0) {
            return false;
        }
        var time = animator.reactiveDataStatus.time;
        for (let i = 0; i < this.dc.length; i += 2) {
            if (this.dc[i] <= time && this.dc[i + 1] >= time) {
                return true;
            }
        }
        return false;
    }

    getIcon() {
        if (this.died()) {
            return deadIcon;
        }
        if (this.downed()) {
            return downIcon;
        }
        if (this.disconnected()) {
            return dcIcon;
        }
        return this.img;
    }

}

class EnemyIconDrawable extends IconDrawable {
    constructor(start, end, imgSrc, pixelSize, pos) {
        super(start, end, imgSrc, pixelSize);
        this.pos = pos;
    }
}
//// BASE MECHANIC
class MechanicDrawable {
    constructor(start, end, connectedTo) {
        this.start = start;
        this.end = end;
        this.connectedTo = connectedTo;
        this.master = null;
    }

    draw() {
        // to override
    }

    getPosition() {
        if (this.connectedTo === null) {
            return null;
        }
        var time = animator.reactiveDataStatus.time;
        if (this.start !== -1 && (this.start >= time || this.end <= time)) {
            return null;
        }
        if (this.connectedTo instanceof Array) {
            return {
                x: this.connectedTo[0],
                y: this.connectedTo[1]
            };
        } else {
            if (this.master === null) {
                let masterId = this.connectedTo;
                this.master = animator.playerData.has(masterId) ? animator.playerData.get(masterId) : animator.trashMobData.has(masterId) ? animator.trashMobData.get(masterId) : animator.targetData.get(masterId);
            }
            return this.master.getPosition();
        }
    }

}
//// FACING
class FacingMechanicDrawable extends MechanicDrawable {
    constructor(start, end, connectedTo, facingData) {
        super(start, end, connectedTo);
        this.facingData = facingData;
    }

    getRotation() {
        if (this.facingData.length === 0) {
            return null;
        }
        var time = animator.reactiveDataStatus.time;
        if (this.start !== -1 && (this.start >= time || this.end <= time)) {
            return null;
        }
        if (this.facingData.length === 1) {
            return this.facingData[0];
        }
        const lastTime = animator.times[animator.times.length - 1];
        const startIndex = Math.ceil((animator.times.length - 1) * Math.max(this.start, 0) / lastTime);
        const currentIndex = Math.floor((animator.times.length - 1) * time / lastTime);
        const offsetedIndex = Math.max(currentIndex - startIndex, 0);
        return this.facingData[offsetedIndex]; 
    }

    draw() {
        const pos = this.getPosition();
        const rot = this.getRotation();
        if (pos === null || rot === null) {
            return;
        }
        var ctx = animator.mainContext;
        const angle = rot * Math.PI / 180;
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);
        const facingFullSize = 5 * this.master.pixelSize / (3 * animator.scale);
        const facingHalfSize = facingFullSize / 2;
        ctx.drawImage(facingIcon, -facingHalfSize, -facingHalfSize, facingFullSize, facingFullSize);
        ctx.restore();
    }
}

class FacingRectangleMechanicDrawable extends FacingMechanicDrawable {
    constructor(start, end, connectedTo, facingData, width, height, color) {
        super(start, end, connectedTo, facingData);
        this.width = width;
        this.height = height;
        this.color = color;
    }

    draw() {
        const pos = this.getPosition();
        const rot = this.getRotation();
        if (pos === null || rot === null) {
            return;
        }
        var ctx = animator.mainContext;
        const angle = rot * Math.PI / 180;
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.rect(- 0.5 * this.width, - 0.5 * this.height, this.width, this.height);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}
//// FORMS
class FormMechanicDrawable extends MechanicDrawable {
    constructor(start, end, fill, growing, color, connectedTo) {
        super(start, end, connectedTo);
        this.fill = fill;
        this.growing = growing;
        this.color = color;
    }

    getPercent() {
        if (this.growing === 0) {
            return 1.0;
        }
        var time = animator.reactiveDataStatus.time;
        return Math.min((time - this.start) / (this.growing - this.start), 1.0);
    }
}

class CircleMechanicDrawable extends FormMechanicDrawable {
    constructor(start, end, fill, growing, color, radius, connectedTo, minRadius) {
        super(start, end, fill, growing, color, connectedTo);
        this.radius = radius;
        this.minRadius = minRadius;
    }

    draw() {
        const pos = this.getPosition();
        if (pos === null) {
            return;
        }
        var ctx = animator.mainContext;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.getPercent() * (this.radius - this.minRadius) + this.minRadius, 0, 2 * Math.PI);
        if (this.fill) {
            ctx.fillStyle = this.color;
            ctx.fill();
        } else {
            ctx.lineWidth = (2 / animator.scale).toString();
            ctx.strokeStyle = this.color;
            ctx.stroke();
        }
    }
}

class DoughnutMechanicDrawable extends FormMechanicDrawable {
    constructor(start, end, fill, growing, color, innerRadius, outerRadius, connectedTo) {
        super(start, end, fill, growing, color, connectedTo);
        this.outerRadius = outerRadius;
        this.innerRadius = innerRadius;
    }

    draw() {
        const pos = this.getPosition();
        if (pos === null) {
            return;
        }
        var ctx = animator.mainContext;
        const percent = this.getPercent();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.innerRadius + percent * (this.outerRadius - this.innerRadius), 2 * Math.PI, 0, false);
        ctx.arc(pos.x, pos.y, this.innerRadius, 0, 2 * Math.PI, true);
        ctx.closePath();
        if (this.fill) {
            ctx.fillStyle = this.color;
            ctx.fill();
        } else {
            ctx.lineWidth = (2 / animator.scale).toString();
            ctx.strokeStyle = this.color;
            ctx.stroke();
        }
    }
}

class RectangleMechanicDrawable extends FormMechanicDrawable {
    constructor(start, end, fill, growing, color, width, height, connectedTo) {
        super(start, end, fill, growing, color, connectedTo);
        this.height = height;
        this.width = width;
    }

    draw() {
        const pos = this.getPosition();
        if (pos === null) {
            return;
        }
        var ctx = animator.mainContext;
        const percent = this.getPercent();
        ctx.beginPath();
        ctx.rect(pos.x - 0.5 * percent * this.width, pos.y - 0.5 * percent * this.height, percent * this.width, percent * this.height);
        if (this.fill) {
            ctx.fillStyle = this.color;
            ctx.fill();
        } else {
            ctx.lineWidth = (2 / animator.scale).toString();
            ctx.strokeStyle = this.color;
            ctx.stroke();
        }
    }
}

class RotatedRectangleMechanicDrawable extends RectangleMechanicDrawable {
    constructor(start, end, fill, growing, color, width, height, rotation, translation, spinangle, connectedTo) {
        super(start, end, fill, growing, color, width, height, connectedTo);
        this.rotation = -rotation * Math.PI / 180; // positive mathematical direction, reversed since JS has downwards increasing y axis
        this.translation = translation;
        this.spinangle = -spinangle * Math.PI / 180; // positive mathematical direction, reversed since JS has downwards increasing y axis
    }

    getSpinPercent() {
        if (this.spinangle === 0) {
            return 1.0;
        }
        var time = animator.reactiveDataStatus.time;
        return Math.min((time - this.start) / (this.end - this.start), 1.0);
    }

    draw() {
        const pos = this.getPosition();
        if (pos === null) {
            return;
        }
        var ctx = animator.mainContext;
        const percent = this.getPercent();
        const spinPercent = this.getSpinPercent();
        const offset = {
            x: pos.x, // - 0.5 * percent * this.width,
            y: pos.y // - 0.5 * percent * this.height
        };
        const angle = this.rotation + spinPercent * this.spinangle;
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.rotate(angle % 360);
        ctx.beginPath();
        ctx.rect((-0.5 * this.width + this.translation) * percent, -0.5 * percent * this.height, percent * this.width, percent * this.height);
        if (this.fill) {
            ctx.fillStyle = this.color;
            ctx.fill();
        } else {
            ctx.lineWidth = (2 / animator.scale).toString();
            ctx.strokeStyle = this.color;
            ctx.stroke();
        }
        ctx.restore();
    }
}

class PieMechanicDrawable extends FormMechanicDrawable {
    constructor(start, end, fill, growing, color, direction, openingAngle, radius, connectedTo) {
        super(start, end, fill, growing, color, connectedTo);
        this.direction = -direction * Math.PI / 180; // positive mathematical direction, reversed since JS has downwards increasing y axis
        this.openingAngle = 0.5 * openingAngle * Math.PI / 180;
        this.radius = radius;
        this.dx = Math.cos(this.direction - this.openingAngle) * this.radius;
        this.dy = Math.sin(this.direction - this.openingAngle) * this.radius;
    }

    draw() {
        const pos = this.getPosition();
        if (pos === null) {
            return;
        }
        var ctx = animator.mainContext;
        const percent = this.getPercent();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x + this.dx * percent, pos.y + this.dy * percent);
        ctx.arc(pos.x, pos.y, percent * this.radius, this.direction - this.openingAngle, this.direction + this.openingAngle);
        ctx.closePath();
        if (this.fill) {
            ctx.fillStyle = this.color;
            ctx.fill();
        } else {
            ctx.lineWidth = (2 / animator.scale).toString();
            ctx.strokeStyle = this.color;
            ctx.stroke();
        }
    }
}

class LineMechanicDrawable extends FormMechanicDrawable {
    constructor(start, end, fill, growing, color, connectedFrom, connectedTo) {
        super(start, end, fill, growing, color, connectedTo);
        this.connectedFrom = connectedFrom;
        this.endmaster = null;
    }

    getTargetPosition() {
        if (this.connectedFrom === null) {
            return null;
        }
        var time = animator.reactiveDataStatus.time;
        if (this.start !== -1 && (this.start >= time || this.end <= time)) {
            return null;
        }
        if (this.connectedFrom instanceof Array) {
            return {
                x: this.target[0],
                y: this.target[1]
            };
        } else {
            if (this.endmaster === null) {
                let endMasterID = this.connectedFrom;
                this.endmaster = animator.playerData.has(endMasterID) ? animator.playerData.get(endMasterID) : animator.trashMobData.has(endMasterID) ? animator.trashMobData.get(endMasterID) : animator.targetData.get(endMasterID);
            }
            return this.endmaster.getPosition();
        }
    }

    draw() {
        const pos = this.getPosition();
        const target = this.getTargetPosition();
        if (pos === null || target === null) {
            return;
        }
        var ctx = animator.mainContext;
        const percent = this.getPercent();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x + percent * (target.x - pos.x), pos.y + percent * (target.y - pos.y));
        ctx.lineWidth = (2 / animator.scale).toString();
        ctx.strokeStyle = this.color;
        ctx.stroke();
    }
}
//// BACKGROUND
class BackgroundDrawable {
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }

    draw() {
        // to override
    }

    getHeight() {
        // to override
    }

    getPosition() {
        // to override
    }
}

class MovingPlatformDrawable extends BackgroundDrawable {
    constructor(start, end, image, width, height, positions) {
        super(start, end);
        this.image = new Image();
        this.image.src = image;
        this.image.onload = function () {
            animateCanvas(-1);
        };
        this.width = width;
        this.height = height;
        this.positions = positions;
        if (this.positions.length > 1) {
            this.currentIndex = 0;
            this.currentStart = Number.NEGATIVE_INFINITY;
            this.currentEnd = positions[0][5];
        }
    }

    draw() {
        const pos = this.getInterpolatedPosition();
        if (pos === null) {
            return;
        }
        let ctx = animator.mainContext;
        const rads = pos.angle;
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(rads % (2 * Math.PI));
        ctx.globalAlpha = pos.opacity;
        ctx.drawImage(this.image, -0.5 * this.width, -0.5 * this.height, this.width, this.height);
        ctx.restore();
    }

    getHeight() {
        let position = this.getInterpolatedPosition();
        if (position === null) {
            return Number.NEGATIVE_INFINITY;
        }

        return position.z;
    }

    getInterpolatedPosition() {
        let time = animator.reactiveDataStatus.time;
        if (time < this.start || time > this.end) {
            return null;
        }
        if (this.positions.length === 0) {
            return null;
        }
        if (this.positions.length === 1) {
            return {
                x: this.positions[0][0],
                y: this.positions[0][1],
                z: this.positions[0][2],
                angle: this.positions[0][3],
                opacity: this.positions[0][4],
            };
        }

        let i;
        let changed = false;
        if (this.currentStart <= time && time < this.currentEnd) {
            i = this.currentIndex;
        } else {
            for (i = 0; i < this.positions.length; i++) {
                let positionTime = this.positions[i][5];
                if (positionTime > time) {
                    break;
                }
            }
            changed = true;
        }

        if (changed) {
            this.currentIndex = i;
            if (i === 0) {
                this.currentStart = Number.NEGATIVE_INFINITY;
                this.currentEnd = this.positions[0][5];
            } else {
                this.currentStart = this.positions[i - 1][5];
                if (i === this.positions.length) {
                    this.currentEnd = Number.POSITIVE_INFINITY;
                } else {
                    this.currentEnd = this.positions[i][5];
                }
            }
        }

        if (i === 0) {
            // First position is in the future
            return null;
        }

        if (i === this.positions.length) {
            // The last position is in the past, use the last position
            return {
                x: this.positions[i - 1][0],
                y: this.positions[i - 1][1],
                z: this.positions[i - 1][2],
                angle: this.positions[i - 1][3],
                opacity: this.positions[i - 1][4],
            };
        }

        let progress = (time - this.positions[i - 1][5]) / (this.positions[i][5] - this.positions[i - 1][5]);

        return {
            x: (this.positions[i - 1][0] * (1 - progress) + this.positions[i][0] * progress),
            y: (this.positions[i - 1][1] * (1 - progress) + this.positions[i][1] * progress),
            z: (this.positions[i - 1][2] * (1 - progress) + this.positions[i][2] * progress),
            angle: (this.positions[i - 1][3] * (1 - progress) + this.positions[i][3] * progress),
            opacity: (this.positions[i - 1][4] * (1 - progress) + this.positions[i][4] * progress),
        };
    }
}
