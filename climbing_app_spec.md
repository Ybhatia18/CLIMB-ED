# BetaVision: AI-Powered Climbing Route Assistant

**Author:** Monke
**Status:** Spec / Planning
**Last updated:** September 22, 2026

---

## 1. Vision

BetaVision is a mobile app (React Native + Expo) that turns a phone photo of a climbing wall into an interactive coaching tool for beginner climbers. Take a photo of the wall, tap the color you want to climb, and the app shows you:

1. Which holds belong to that route.
2. An honest, gym-agnostic difficulty estimate (because gym grades are wildly inconsistent).
3. A physics-aware step-by-step beta guide: a stick-figure climber overlaid on your photo, advancing one move at a time as you tap "next." Each step shows where the four points of contact go and what the body position should look like.

No live AR for V1. Study the route on the ground, memorize the beta, climb. This matches how climbers actually use route information. Built with Expo so development iterates over-the-air to Expo Go on the phone, and the same codebase ships to both iOS and Android with no platform-specific code.

The target user is someone in their first 6–18 months of climbing who can recognize a hold but struggles with movement, body positioning, and reading sequences. Experienced climbers are not the focus, though they may use it for warm-up routes or coaching others.

## 2. Why This Is Worth Building

Beginner climbers consistently get stuck on the same problem: they can see the holds but not the *movement*. YouTube beta videos exist, but only for famous outdoor lines. Inside a gym, you are mostly on your own. Existing apps (Kaya, Climbing Log, Boulder Companion) focus on logging and social features, not on actual route reading and coaching.

The technical novelty is in the second half: a biomechanics-aware model that reasons about a climber's body as a kinematic chain with 3–4 points of contact and predicts which sequences are stable vs. strenuous. To my knowledge, no consumer climbing app does this.

## 3. Core Features (MVP through V2)

### 3.1 Route Segmentation from a Single Photo

User takes a photo of a wall. The app:

- Detects all climbing holds on the wall (object detection).
- Clusters them by color (a "route" in most gyms = one color).
- Lets the user tap a hold or pick a swatch to select the route.
- Highlights every hold on that route, including hard-to-spot ones in shadow or far corners.

Stretch: detect tape markings, volume edges, and start/finish jugs.

### 3.1.1 User-Assisted Hold Tagging

Hold *type* — jug vs. crimp vs. sloper — is one of the hardest things to infer reliably from a single 2D photo; shape, texture, and grip quality often look similar under gym lighting. Rather than lean entirely on the CV model to guess, let the user tag it directly.

After segmentation, each detected hold renders as a bounding box on the photo. Tapping a box opens a picker:

- Jug
- Crimp
- Sloper
- Pinch
- Pocket
- Edge
- Sidepull
- Undercling
- Gaston
- Horn
- Volume
- Dual-texture hold
- Foothold (chip)
- **Custom** — free-text description for anything that doesn't fit ("wet sloper," "sharp crimp, bad edge")

Tagging is per-hold and optional — a climber shouldn't have to classify all 25 holds on a wall before they can see their route. Untagged holds fall back to the CV model's best guess, or a generic "unknown" that the difficulty and beta models treat conservatively.

This does double duty: it directly sharpens the difficulty and beta-optimizer inputs (§3.2, §3.3) for *this* climb, and every submitted tag becomes a labeled training example. Over time this is a free, in-product data-labeling flywheel toward an automatic hold-type classifier — exactly the kind of labeled data the "few thousand additional gym photos" in §4.3 need, except labeled by the people actually using the app instead of purchased labeling work.

### 3.2 Difficulty Calibration

Gym grades drift. A V3 at one gym is a soft V4 at another, and setters have personal styles. BetaVision should give a "true" difficulty score independent of the tag on the wall.

Inputs to the difficulty model:

- Hold type and size — from the user's tag (§3.1.1) when available, otherwise the CV model's best guess.
- Spacing and reach between consecutive holds in the optimal sequence.
- Wall angle (slab, vertical, overhang).
- Foothold availability between major holds.
- The body positions the route forces.

Output: a calibrated grade (e.g. "feels like V3 at most gyms, gym tagged it V4") and a confidence interval.

### 3.3 Physics-Based Beta Suggestion with Step-by-Step Dummy Overlay

This is the hardest and most differentiated feature.

Model the climber as a simplified kinematic chain (torso, two arms, two legs, head) with adjustable parameters: height, ape index, weight. For each candidate sequence of 3–4 contact points:

- Compute center of mass.
- Solve for static equilibrium given gravity and reaction forces at each contact.
- Estimate force/torque at each hold and at major joints (shoulder, elbow, hip, knee).
- Cap each contact's reaction-force ceiling by hold type (§3.1.1): a jug takes a high-confidence positive grip, a sloper or gaston is friction-limited and penalized harder under load, a crimp is precise but low-surface-area. Untagged holds use the CV model's guess, held to a wider, more conservative margin.
- Score the configuration on stability (does CoM stay over the support polygon?) and strain (is any single joint overloaded?).

The optimal beta is the sequence that minimizes peak strain while keeping the climber stable through every transition.

**User-facing output: the dummy walkthrough.** Render a stick-figure climber overlaid on the uploaded photo. Each "step" of the beta is a single pose: four limbs assigned to four holds, body positioned in static equilibrium. The user taps "next" to advance to the next move, watching the dummy transition between poses. Visual conventions:

- Clean line-art stick figure with circles for joints. No 3D rendering, no realistic body — readability beats realism.
- Color-coded contact points: red for gripping hands, blue for standing feet. Inactive limbs (mid-transition) are gray and dashed.
- The hold being moved to is highlighted on the photo (pulsing outline or arrow).
- Short text annotation per step: "drop knee right," "flag left foot," "match on the jug," "high step to the crimp."
- "See all steps" overview mode shows a strip of all poses for the full route, so climbers can study the whole sequence before climbing.

This is the part that actually teaches. The physics is the engine; the dummy walkthrough is the product.

### 3.4 Personalization

Profile fields: height, ape index, weight, dominant hand, current grade, known injuries or weaknesses (e.g. tight hips, weak fingers). The beta engine re-runs whenever a user with a different morphology selects the same route, so a 5'4" climber and a 6'2" climber get different recommendations on the same wall.

## 4. Technical Architecture

```
[Expo / RN client] ──photo──▶ [Backend API] ──▶ [CV pipeline] ──▶ [Difficulty model]
       ▲                                                  │              │
       │                                                  ▼              ▼
       └────── overlay + dummy walkthrough ◀──── [Beta optimizer / physics engine]
```

### 4.1 Mobile Client (React Native + Expo)

React Native via Expo SDK, written in TypeScript. Justification: one codebase ships to both iOS and Android, Expo Go gives a sub-second hot-reload dev loop (scan a QR code, see the change on your phone), and you can hand the QR code to anyone with Expo Go installed to test in the gym. No Xcode, no Android Studio, no app store review during development.

Key Expo modules, all bundled in stock Expo Go (no development build needed for V1):

- `expo-camera` or `expo-image-picker` — in-app capture and gallery upload.
- `react-native-svg` — renders the stick-figure dummy overlay on the photo.
- `expo-sensors` — accelerometer access for the wall-angle pre-fill.
- `expo-router` — file-based navigation, feels similar to Next.js routing.
- `expo-secure-store` — auth tokens.

**Expo Go vs. development build.** Stock Expo Go is sufficient for all of Phases 0–4. The moment you want native modules outside Expo Go's bundle (e.g. ARKit/ARCore for live overlay in a hypothetical V2), graduate to an Expo development build via `eas build --profile development`. Same QR-code dev loop, just with your own custom native module set. Plan for this transition but don't pre-optimize for it.

**Wall angle input:** a simple slider asking "slab / vertical / overhang, how steep?" on first photo. Pre-fill from `expo-sensors` accelerometer reading if the user took the photo on their phone — held against the wall, gravity tells you the wall angle directly.

### 4.2 Backend

Python + FastAPI. PostgreSQL for users, gyms, routes, and saved sends. Object storage (S3 or equivalent) for uploaded photos.

Routes get cached: if multiple users upload the same wall, do not re-run segmentation from scratch. Use perceptual hashing on the wall region to dedupe.

### 4.3 Computer Vision Pipeline

1. **Hold detection.** Fine-tune a YOLOv8 or YOLO-NAS model on a custom dataset of climbing holds. Public datasets exist (e.g. the Hold Detection dataset on Roboflow) but are small; expect to label at least a few thousand additional gym photos.
2. **Hold segmentation.** Run SAM (Segment Anything) on each detected bounding box to get a tight mask. This matters because color clustering on a bounding box pulls in wall pixels and ruins everything.
3. **Color classification.** Convert each hold mask to HSV, take the dominant color, cluster across all holds in the image. Most gyms use 6–10 distinct route colors, so HDBSCAN with a small min_cluster_size works well. Handle lighting variation by normalizing against the wall background color.
4. **Hold type — user-sourced, not inferred.** Classifying jug vs. crimp vs. sloper from pixels alone is genuinely hard from a single photo, so V1 doesn't try: it's collected directly from the user via the tagging UI in §3.1.1. Once there's enough tagged volume, a lightweight classifier can pre-fill a suggested tag for the user to confirm instead of picking from scratch — a later optimization, not a Phase 1 dependency.
5. **Wall geometry from user input + shadow analysis.** Without AR, wall geometry comes from two sources. First, a one-time user input per photo: a slider for wall angle (slab / vertical / overhang) with a numeric estimate. Beginners can eyeball this; if the photo was taken with a phone held against the wall, pre-fill from the browser's DeviceOrientation API. Second, infer per-hold protrusion from cast shadows using shape from shading.

6. **Hold protrusion via shape from shading.** Wall angle tells you the wall's orientation; protrusion tells you how far each hold sticks out from it. Protrusion matters for the physics: a jug protrudes several inches and is positively grippable, while a crimp barely protrudes and demands precise loading. Climbing gyms solve half this problem for you. Directional overhead lighting means each hold casts a shadow whose length encodes its protrusion. Given a known light direction (calibrate once per gym, or infer from the dominant shadow direction in the image), shadow length plus trig gives protrusion height: `h = shadow_length / tan(θ)`, where θ is the light's angle from vertical. This is a real CV technique called shape from shading and gives you a usable per-hold depth offset from just the uploaded photo. No AR, no extra hardware. Final 3D hold position = wall-plane projection + protrusion along the wall normal.

### 4.4 Difficulty Model

Two paths, probably layered:

- **Heuristic baseline.** Hand-coded rules using hold type, spacing, and wall angle. Gives a sane starting grade and is interpretable.
- **Learned correction.** Gradient-boosted model (XGBoost) trained on user-submitted "this felt easier/harder than tagged" data. Over time, this learns the gym-to-gym calibration drift.

### 4.5 Beta Optimizer

The core algorithm:

```
inputs: list of holds (3D positions estimated from image, hold type from user tag or CV fallback — §3.1.1), climber morphology
output: sequence of body poses (each pose = 4 contact assignments + joint angles)

1. Generate candidate transitions using A* over the graph of possible 4-hold subsets.
2. For each candidate pose, run inverse kinematics to find feasible joint angles.
3. Score each pose with a static equilibrium check + joint torque estimate.
4. Penalize transitions that require dynamic moves (a beginner-focused model).
5. Return the lowest-cost full sequence.
```

PyBullet or a custom 2D-with-depth rigid body solver works for V1. Full 3D physics with friction modeling is V2+ territory. For the IK piece, ikpy or a custom analytical solver for the simplified skeleton is fine.

This piece is where the hard, original engineering lives. Expect this to be the long pole.

## 5. Tech Stack Summary

| Layer | Choice | Why |
|---|---|---|
| Mobile | React Native + Expo (TypeScript) | One codebase iOS+Android, Expo Go hot-reload loop |
| Navigation | expo-router | File-based, Next.js-like ergonomics |
| Camera | expo-camera / expo-image-picker | Bundled in Expo Go, no native config |
| Overlay rendering | react-native-svg | Stick-figure dummy on top of photo |
| Sensors | expo-sensors | Accelerometer for wall-angle prefill |
| Backend | FastAPI (Python) | Fast, async, clean for ML serving |
| DB | PostgreSQL | You have prior experience, good fit |
| Object detection | YOLOv8 fine-tuned | Strong baseline, easy to deploy |
| Segmentation | SAM (lightweight variant) | Best-in-class hold masking |
| Difficulty | XGBoost on engineered features | Interpretable, small data friendly |
| Physics | PyBullet or custom solver | Mature, lots of robotics references |
| IK | ikpy | Simple, good enough for V1 |
| Hosting | Fly.io / Railway for backend, S3 for blobs, EAS for app builds when ready | Cheap for solo project scale |

## 6. Building Roadmap

A realistic phased plan. Each phase is a usable product on its own, which matters for keeping motivation up and for putting something on a resume / GitHub before the whole thing is done.

### Phase 0 — Data and Scaffolding (2–3 weeks)

- Collect 200–500 photos from local gyms (Rutgers area, Brooklyn Boulders, etc.). Get permission first.
- Label holds and route colors. Roboflow has free tooling for this.
- `npx create-expo-app betavision`, set up TypeScript, expo-router, and the basic screen scaffolding.
- Spin up FastAPI skeleton + Postgres schema. Deploy backend to Fly.io / Railway day one so it's never the blocker.
- Wire the Expo app to take a photo via `expo-image-picker` and POST it to a `/upload` endpoint that just returns 200. End of phase: full round-trip works on your phone via Expo Go.

### Phase 1 — Route Segmentation MVP (3–4 weeks)

- Train YOLOv8 on the labeled dataset.
- Plug in SAM for fine masks.
- Color clustering pipeline.
- App UI: take photo → see all detected holds → tap a hold → all same-color holds light up via `react-native-svg` overlay.
- Hold-tagging UI (§3.1.1): tap a detected hold's bounding box, pick a type from the dropdown or write a custom description.

This alone is shippable and useful. It is also a strong portfolio piece on its own. End of phase: you can hand someone an Expo Go QR code and they can use the app at a real gym.

### Phase 2 — Difficulty Calibration (3–4 weeks)

- Hand-coded heuristic grade based on hold types and spacing.
- Add user feedback loop: "did this feel like the tagged grade?"
- Train the XGBoost correction model once you have ~500 labeled feedback points.

### Phase 3 — Beta Engine V1 + Dummy Walkthrough (6–8 weeks, the heavy lift)

- Build the simplified climber skeleton model.
- Implement the static equilibrium check.
- A* over hold subsets to find candidate sequences.
- Render the output as a step-by-step SVG stick-figure overlay on the photo. Numbered steps, "next" button, color-coded contact points, short text cues per move.

### Phase 4 — Personalization and Polish (3–4 weeks)

- User profile with morphology fields (height, ape index, weight).
- Re-run the optimizer with the user's actual measurements so the dummy reflects their body.
- "See all steps" overview mode.
- Save routes, share via link.

### Phase 5 — Launch (ongoing)

- Onboarding flow.
- Friend / gym leaderboard if you want a social angle.
- Soft-launch with climbers from your home gym, gather feedback, iterate.

Total realistic timeline solo, around school: 7–9 months to get through Phase 4. Slightly faster than the native-app timeline because there's no app store review, no platform-specific code paths, and no AR plumbing.

## 7. Hard Problems and Open Questions

These are the things that will eat time and that you should think about before committing.

**Depth is now approximate.** Without AR, wall geometry comes from user input and shape-from-shading rather than ARKit-quality sensor fusion. This is fine for V1 because the dummy walkthrough doesn't need millimeter precision — it needs to pick the right sequence and show roughly correct body positions. If the physics engine starts producing visibly wrong poses (dummy floating off the wall, wrong limbs assigned), revisit. AR can always be added later via a Capacitor wrap if needed.

**Shape-from-shading is approximate, not exact.** Protrusion estimates depend on detecting clean shadows and knowing the light direction. In gyms with diffuse lighting, multiple competing light sources, or near corners, shadows get muddy. Mitigation: per-gym calibration. Have the user photograph a reference hold of known protrusion (a standard jug works) on first visit, store the inferred light direction as a per-gym prior, and reuse it for subsequent uploads from that gym.

**Future native wrap is on the table, not the critical path.** If V1 takes off and users start asking for live AR overlay, wrap the webapp in Capacitor and expose ARKit/ARCore via native plugins. This is a 2–3 week project, not a rewrite. But do not pre-optimize for it. Ship the webapp first.

**Climbing physics is not just statics.** Real climbing involves dynamic moves, momentum, and friction that depends on hold texture and chalk. The V1 model that assumes static equilibrium will be wrong for routes that require deadpoints or campus moves. That is fine, since the target user is a beginner mostly on static routes, but be honest about the limitation.

**Friction coefficients are unknown.** You cannot measure how grippy a hold is from a photo. You can estimate by hold type (rubber feet vs. sandstone-textured plastic) but it is rough. Treat friction as a soft prior, not a hard constraint.

**Data labeling is the boring 80%.** Plan to spend significant time labeling. Without good data, none of the ML pieces work. Consider crowdsourcing from your gym's beginner community in exchange for free access.

**Gym permissions and IP.** Some gyms get weird about photos of their walls (proprietary route setting). Get permission, or scope the MVP to one or two friendly gyms first.

**Mobile compute.** SAM and YOLO are not free. Server-side inference is fine for a beta but will cost money at scale. Look at quantized models for eventual on-device options.

## 8. Stretch Features (Post-V2)

- Video upload: watch a climber attempt a route and tell them where they went off-beta.
- AR mode: live overlay of the optimal sequence as you look at the wall through your phone.
- Training plan integration: "you keep failing on overhung crimpy routes, here are 3 hangboard exercises."
- Outdoor mode using crag photos and grade databases like Mountain Project.
- Multi-user / community routes: users post their own beta and others vote.

## 9. Resume / Portfolio Framing

Once Phase 1 ships, this becomes a strong project to talk about in recruiting:

- "I trained a fine-tuned YOLOv8 model on N gym photos to segment climbing routes by color, served via FastAPI to a React Native client."

After Phase 3:

- "I built a physics-based motion planner that models the climber as a kinematic chain and optimizes for joint strain and stability across candidate hold sequences."

That second sentence does heavy lifting in interviews for any role that touches ML, robotics, or applied physics.

## 10. Next Concrete Steps

1. Pick one home gym where you can get permission to photograph walls freely.
2. Spend a week shooting 100–200 photos at varied lighting and angles.
3. Set up Roboflow and start labeling.
4. Spin up a fresh repo with a Next.js frontend and FastAPI backend skeleton. Deploy the empty shell to Vercel + Fly.io on day one so deployment is never the blocker.
5. Get a YOLOv8 model trained on the small initial dataset, even if it is rough. Wire it into the upload-and-display flow. Iterate from there.

Do not try to design the full physics engine before you can detect a hold. Each phase exists for a reason.
