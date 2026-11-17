/* 参数预览只演示编辑效果：无 Box2D 求解器、完整骨骼导入或生产级粒子运行时。 */
/* global I18n -- 画布标注复用界面语言，不改变效果参数。 */
/* exported EffectsPreview -- 提供有界效果示意，不代表正式引擎。 */
'use strict';
const EffectsPreview = (() => {
  // 画布不属于DOM文本，使用同一目录输出标题与调试标注。
  const localText = (ctx, text, ...args) => ctx.fillText(I18n.translate(text), ...args);
  const WIDTH = 800;
  const HEIGHT = 450;
  const TAU = Math.PI * 2;

  // 预览限制输入与工作量，异常草稿不会制造无界粒子或非有限坐标。
  function number(value, fallback, min, max) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
  }

  // 固定种子按粒子索引计算，重播与暂停不依赖调用次数。
  function random(seed, index, lane) {
    let bits = Math.imul((seed | 0) ^ Math.imul(index + 1, 374761393), 668265263 + lane * 31);
    bits = Math.imul(bits ^ (bits >>> 13), 1274126177);
    return ((bits ^ (bits >>> 16)) >>> 0) / 4294967296;
  }

  // 颜色仅接受明确十六进制值，错误输入使用预设色而不继承上一绘制状态。
  function color(value, fallback) {
    return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)
      ? value : fallback;
  }

  // 所有视口都使用相同逻辑尺寸；CSS 缩放由外层负责。
  function background(ctx, title) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#10192c';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = '#24314b';
    ctx.lineWidth = 1;
    for (let x = 40; x < WIDTH; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 45); ctx.lineTo(x, 398); ctx.stroke();
    }
    for (let y = 78; y < 398; y += 40) {
      ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(770, y); ctx.stroke();
    }
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#edf3ff';
    localText(ctx,title, 24, 31);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aab9d5';
    localText(ctx,'参数动态示意 · 不代表真实游戏引擎', 24, 428);
  }

  // 刚体形状只用于单物体示意，不执行任意形状接触求解。
  function body(ctx, x, y, radius, shape, sensor, angle) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    ctx.strokeStyle = sensor ? '#f5c15c' : '#8cbeff';
    ctx.fillStyle = sensor ? '#f5c15c25' : '#4a83ee';
    ctx.lineWidth = 3;
    ctx.setLineDash(sensor ? [7, 5] : []);
    ctx.beginPath();
    if (shape === 'circle' || shape === '圆形') ctx.arc(0, 0, radius, 0, TAU);
    else if (shape === 'capsule' || shape === '胶囊') ctx.roundRect(-radius * 0.7, -radius, radius * 1.4, radius * 2, radius * 0.7);
    else ctx.roundRect(-radius, -radius, radius * 2, radius * 2, 7);
    ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-8, -5, 3, 0, TAU); ctx.arc(8, -5, 3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // 分段解析抛物线处理落地与反弹，迭代有上限；这不是 Box2D。
  function falling(time, gravity, bounce, friction, sensor) {
    let remaining = time;
    let y = 92;
    let velocity = 0;
    let contacts = 0;
    const floor = 321;
    let x = 210;
    x += friction < 0.001 ? time * 85 : (1 - Math.exp(-friction * time * 2)) * 85 / (friction * 2);
    x = Math.min(710, x);
    if (sensor || gravity < 0.001) return { x, y: y + gravity * time * time * 0.5, contacts, grounded: false };
    for (let step = 0; step < 32; step += 1) {
      const hit = (-velocity + Math.sqrt(velocity * velocity + 2 * gravity * (floor - y))) / gravity;
      if (remaining < hit) return { x, y: y + velocity * remaining + gravity * remaining * remaining * 0.5,
        contacts, grounded: false };
      remaining -= hit;
      velocity = -(velocity + gravity * hit) * bounce;
      y = floor;
      contacts += 1;
      if (Math.abs(velocity) < 8 || remaining <= 0) break;
    }
    return { x, y: floor, contacts, grounded: true };
  }

  // 固定、自然掉落和受控移动有不同可见结果，触发器会穿过地面。
  function physics(ctx, params, time) {
    const gravity = number(params.gravity, 9.8, 0, 40);
    const bounce = number(params.bounce, 0.55, 0, 1);
    const friction = number(params.friction, 0.3, 0, 1);
    const type = params.bodyType || 'dynamic';
    const sensor = Boolean(params.sensor);
    let state = falling(time, gravity * 17, bounce, friction, sensor);
    if (type === 'static' || type === '固定') state = { x: 400, y: 225, contacts: 0, grounded: false };
    if (type === 'kinematic' || type === '受控') state = {
      x: 400 + Math.sin(time * 1.2) * 150, y: 220 + Math.sin(time * 2) * 45, contacts: 0, grounded: false,
    };
    ctx.fillStyle = '#263d51'; ctx.fillRect(28, 350, 744, 40);
    ctx.fillStyle = '#60c6a2'; ctx.fillRect(28, 349, 744, 4);
    body(ctx, state.x, state.y, 28, params.shape || 'box', sensor, 0);
    ctx.fillStyle = '#b8c8e3'; ctx.font = '15px sans-serif';
    const label = sensor ? '触发器：穿过地面，不阻挡' : state.grounded ? '已落地 · 复位可再次观察' : '参数变化会改变运动示意';
    localText(ctx,label, 28, 390);
    if (state.y > HEIGHT) {
      ctx.fillStyle = '#f5c15c'; localText(ctx,'↓ 物体已穿过地面', Math.min(state.x, 610), 338);
    }
    return { bodyType: type, bodyY: Number(state.y.toFixed(2)), contacts: state.contacts,
      grounded: state.grounded, gravity, sensor, phase: Math.min(time / 4, 1) };
  }

  // 兼容产品预设名称，不改变底层的四类示意行为。
  function particleKind(value) {
    if (['fire', '火焰'].includes(value)) return 'fire';
    if (['rain', 'snow', 'weather', 'rain-snow', '雨雪'].includes(value)) return 'weather';
    if (['trail', '拖尾'].includes(value)) return 'trail';
    return 'explosion';
  }

  // 每个粒子的寿命来自相同种子；单次模式会自然结束而非无限重播。
  function particleAge(kind, time, lifetime, loop, seed, index, count) {
    const stagger = random(seed, index, 1) * (kind === 'explosion' ? 0.13 : lifetime * 0.8);
    const span = lifetime * (0.7 + random(seed, index, 2) * 0.3);
    const cycle = kind === 'explosion' ? lifetime + 0.55 : lifetime;
    const age = loop ? (time + cycle - stagger) % cycle : time - index / count * stagger;
    return { age, span };
  }

  // 拖尾参考源的位置也按时间解析计算，暂停与跳时不会积累隐藏状态。
  function trailSource(time) {
    return { x: 400 + Math.sin(time * 1.7) * 210, y: 225 + Math.sin(time * 2.9) * 70 };
  }

  // 速度、散布与重力真正参与坐标计算；视觉粒子不承担伤害判定。
  function particlePosition(kind, params, time, age, seed, index) {
    const rand = (lane) => random(seed, index, lane);
    const speed = number(params.speed, 120, 0, 500);
    const spread = number(params.spread, 360, 0, 360) / 180 * Math.PI;
    const gravity = number(params.gravity, kind === 'fire' ? -15 : 35, -300, 300);
    const angle = -Math.PI / 2 + (rand(3) - 0.5) * spread;
    const velocity = speed * (0.35 + rand(4) * 0.65);
    if (kind === 'weather') return {
      x: 30 + rand(5) * 740 + Math.cos(angle) * velocity * age * 0.3,
      y: 45 + velocity * age + gravity * age * age * 0.5,
    };
    if (kind === 'trail') {
      const source = trailSource(Math.max(0, time - age));
      return { x: source.x + Math.cos(angle) * velocity * age * 0.3,
        y: source.y + Math.sin(angle) * velocity * age * 0.3 + gravity * age * age * 0.5 };
    }
    const lift = kind === 'fire' ? Math.abs(Math.sin(angle)) : -Math.sin(angle);
    return { x: 400 + (rand(5) - 0.5) * (kind === 'fire' ? 25 : 3) + Math.cos(angle) * velocity * age,
      y: (kind === 'fire' ? 350 : 225) - lift * velocity * age + gravity * age * age * 0.5 };
  }

  // CPU 有界预览：每帧最多绘制 300 个粒子，不报告假 FPS。
  function particles(ctx, params, time) {
    const kind = particleKind(params.effectPreset || params.preset);
    const count = Math.round(number(params.count, 90, 1, 300));
    const lifetime = number(params.lifetime, 1.5, 0.1, 10);
    const size = number(params.size, 7, 1, 40);
    const seed = number(params.seed, 7, 0, 2147483647);
    const loop = params.loop !== false;
    const tint = color(params.color, kind === 'fire' ? '#ff943c' : kind === 'weather' ? '#b9defc' : '#77c9ff');
    let live = 0;
    ctx.save();
    for (let index = 0; index < count; index += 1) {
      const clock = particleAge(kind, time, lifetime, loop, seed, index, count);
      if (clock.age < 0 || clock.age >= clock.span) continue;
      live += 1;
      const point = particlePosition(kind, params, time, clock.age, seed, index);
      const progress = clock.age / clock.span;
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(0.2, size * (0.4 + random(seed, index, 6) * 0.6) * (1 - progress * 0.5)), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (kind === 'trail') {
      const source = trailSource(time);
      body(ctx, source.x, source.y, 15, 'circle', false, 0);
    }
    ctx.strokeStyle = '#738aac'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(385, kind === 'fire' ? 350 : 225); ctx.lineTo(415, kind === 'fire' ? 350 : 225); ctx.stroke();
    ctx.fillStyle = '#b8c8e3'; ctx.font = '15px sans-serif';
    localText(ctx,'存活 ' + live + ' / 上限 ' + count + ' · 固定种子 ' + seed, 28, 390);
    return { preset: kind, liveParticles: live, particleLimit: count, seed,
      phase: loop ? time % lifetime / lifetime : Math.min(time / (lifetime * 1.8), 1), finished: !loop && live === 0 && time > lifetime };
  }

  // 骨架点由父级旋转计算，局部角度调整不会伪装成任意图片自动绑定。
  function joint(parent, length, angle) {
    return { x: parent.x + Math.cos(angle) * length, y: parent.y + Math.sin(angle) * length };
  }

  // 预设骨链覆盖躯干、双臂与双腿；攻击使用明确的局部关节旋转。
  function pose(clip, phase, offset) {
    const wave = Math.sin(phase * TAU);
    const swing = clip === 'run' ? wave * 0.85 : wave * 0.08;
    const attack = clip === 'attack' ? Math.sin(Math.min(1, phase) * Math.PI) : 0;
    const pelvis = { x: 400, y: 260 + (clip === 'run' ? Math.abs(wave) * -10 : wave * 3) };
    const neck = { x: pelvis.x + attack * 12, y: pelvis.y - 83 };
    const head = { x: neck.x, y: neck.y - 34 };
    const leftShoulder = { x: neck.x - 30, y: neck.y + 13 };
    const rightShoulder = { x: neck.x + 30, y: neck.y + 13 };
    const leftElbow = joint(leftShoulder, 45, Math.PI / 2 + swing);
    const leftHand = joint(leftElbow, 40, Math.PI / 2 + swing * 0.7);
    const rightElbow = joint(rightShoulder, 45, Math.PI / 2 - swing - attack * 2.3);
    const rightHand = joint(rightElbow, 40, Math.PI / 2 - swing * 0.7 - attack * 1.5 + offset);
    const leftHip = { x: pelvis.x - 18, y: pelvis.y };
    const rightHip = { x: pelvis.x + 18, y: pelvis.y };
    const leftKnee = joint(leftHip, 52, Math.PI / 2 - swing);
    const rightKnee = joint(rightHip, 52, Math.PI / 2 + swing);
    const leftFoot = joint(leftKnee, 46, Math.PI / 2 + Math.max(0, swing));
    const rightFoot = joint(rightKnee, 46, Math.PI / 2 + Math.max(0, -swing));
    return { pelvis, neck, head, leftShoulder, rightShoulder, leftElbow, rightElbow,
      leftHand, rightHand, leftHip, rightHip, leftKnee, rightKnee, leftFoot, rightFoot };
  }

  // 画出图形部件而非用户图片，皮肤选择只切换本预设角色的配色。
  function limb(ctx, from, to, thickness, tint) {
    ctx.strokeStyle = tint; ctx.lineWidth = thickness; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  }

  // 可见关节与骨链提供选择和参数反馈；完整权重、IK 与导入属于后续引擎范围。
  function rigOverlay(ctx, rig, edges) {
    ctx.save(); ctx.strokeStyle = '#ffcf6b'; ctx.fillStyle = '#ffcf6b'; ctx.lineWidth = 2;
    for (const [from, to] of edges) limb(ctx, rig[from], rig[to], 2, '#ffcf6b');
    for (const point of Object.values(rig)) {
      ctx.beginPath(); ctx.arc(point.x, point.y, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // 播放速度、循环与单次结束使用统一时间参数，外层掌管 rAF 和暂停生命周期。
  function skeleton(ctx, params, time) {
    const clip = ['idle', 'run', 'attack'].includes(params.clip) ? params.clip : 'idle';
    const duration = clip === 'attack' ? 1 : clip === 'run' ? 0.85 : 2.4;
    const elapsed = time * number(params.speed, 1, 0, 3);
    const phase = params.loop === false ? Math.min(elapsed / duration, 1) : elapsed % duration / duration;
    const rig = pose(clip, phase, number(params.boneAngle, 0, -120, 120) * Math.PI / 180);
    const suit = ['ember', '橙色宇航员'].includes(params.skin) ? '#ffb26b'
      : ['knight', 'red', '红色'].includes(params.skin) ? '#f59390' : '#8dc9ff';
    const edges = [['pelvis', 'neck'], ['neck', 'head'], ['neck', 'leftShoulder'], ['neck', 'rightShoulder'],
      ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftHand'], ['rightShoulder', 'rightElbow'],
      ['rightElbow', 'rightHand'], ['pelvis', 'leftHip'], ['pelvis', 'rightHip'], ['leftHip', 'leftKnee'],
      ['leftKnee', 'leftFoot'], ['rightHip', 'rightKnee'], ['rightKnee', 'rightFoot']];
    ctx.fillStyle = '#18283e'; ctx.beginPath(); ctx.ellipse(400, 372, 85, 13, 0, 0, TAU); ctx.fill();
    for (const [from, to] of edges.slice(4)) limb(ctx, rig[from], rig[to], 23, suit);
    limb(ctx, rig.pelvis, rig.neck, 61, suit);
    ctx.fillStyle = '#69c3e6'; ctx.fillRect(rig.neck.x - 17, rig.neck.y + 23, 34, 31);
    ctx.fillStyle = suit; ctx.beginPath(); ctx.arc(rig.head.x, rig.head.y, 34, 0, TAU); ctx.fill();
    ctx.fillStyle = '#283a57'; ctx.beginPath(); ctx.ellipse(rig.head.x + 5, rig.head.y - 1, 24, 17, 0, 0, TAU); ctx.fill();
    if (clip === 'attack') limb(ctx, rig.rightHand, joint(rig.rightHand, 72, -Math.PI / 3 + phase), 7, '#9ce8ff');
    if (params.showBones !== false) rigOverlay(ctx, rig, edges);
    ctx.fillStyle = '#b8c8e3'; ctx.font = '15px sans-serif';
    localText(ctx,'预设骨架 · 右前臂局部角度 ' + number(params.boneAngle, 0, -120, 120) + '°', 28, 390);
    return { bones: edges.length, joints: Object.keys(rig).length, phase, clip,
      finished: params.loop === false && elapsed >= duration, duration };
  }

  // 对外只暴露无生命周期副作用的绘制函数，空画布调用返回可诊断状态。
  function draw(canvas, kind, params = {}, timeSeconds = 0) {
    const ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    if (!ctx) return { valid: false, kind, liveParticles: 0, bones: 0, phase: 0 };
    if (canvas.width !== WIDTH) canvas.width = WIDTH;
    if (canvas.height !== HEIGHT) canvas.height = HEIGHT;
    const time = number(timeSeconds, 0, 0, 3600);
    const safe = params && typeof params === 'object' ? params : {};
    const title = kind === 'physics' ? '物理与碰撞' : kind === 'particles' ? '粒子特效' : '角色动作';
    canvas.dataset.locale = I18n.locale();
    ctx.save();
    background(ctx, title);
    const stats = kind === 'physics' ? physics(ctx, safe, time)
      : kind === 'particles' ? particles(ctx, safe, time) : skeleton(ctx, safe, time);
    ctx.restore();
    return { valid: true, kind, liveParticles: 0, bones: 0, ...stats };
  }

  return { draw };
})();
