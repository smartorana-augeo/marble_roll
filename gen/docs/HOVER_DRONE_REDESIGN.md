# Hover drone redesign — design specification

**Document type:** creative and mechanical direction (pre-implementation)  
**Project:** `marble_roll` (working title may change)  
**Status:** design intent; does not supersede [`SPEC.md`](../specs/SPEC.md) until adopted

---

## 1. Purpose

Recent builds used a **rolling marble** as the player body. This document specifies a **redesign centred on hover drones** so the game reads as a **small thrust-driven vehicle** rather than a ball platformer, deliberately moving **away** from a Marble Blast Gold–style fantasy.

**Hover drones** naturally support:

- **Glide** and sustained motion without implying “rolling”
- **Thrust**, **momentum**, and **precision** corrections
- **Arcade or exploratory** pacing depending on fiction

The implementation may still use **rigid-body physics** under the hood; the **player-facing language**, **controls**, and **feedback** should describe **propulsion**, not rolling.

---

## 2. Core fantasy: what is the drone doing?

Pick **one** primary fiction early; it drives level goals, UI copy, and art direction. Several strong options:

### 2.1 Maintenance / repair drone

**Premise:** You are a **small autonomous unit** moving through **hazardous infrastructure**.

**Setting examples**

- Space-station ducts and service corridors  
- Suspended industrial platforms  
- Giant greenhouse rafters  
- Weather towers  
- Orbital solar arrays  

**Why it fits:** Natural match for **checkpoint-style** levels, **relay** objectives, and **tight** navigational challenges.

**Goal examples**

- Restore power relays  
- Deliver components to sockets  
- Calibrate antennas or sensors  
- Scan structural damage (waypoint or volume triggers)  

**Conversion note:** Likely the **smoothest** migration from the current “start pad → end pad” flow: replace pads with **service nodes**, **docking volumes**, or **repair targets**.

---

### 2.2 Survey / mapping drone

**Premise:** **Exploration and atmosphere** over raw speed.

**Setting examples**

- Ruins, caverns, floating islands, abandoned arcologies  

**Goal examples**

- Map hidden routes (reveal fog / fill chart)  
- Photograph anomalies (aim reticle + trigger)  
- Discover and activate beacons  

**Tone:** Slower, **elegant** navigation; scoring can reward **clean lines** and **coverage** rather than time alone.

---

### 2.3 Racing / courier drone

**Premise:** **Time-trial** and **momentum** energy closest to classic marble racers, but framed as **delivery** or **circuit racing**.

**Goal examples**

- Deliver data cores through checkpoints  
- Beat sector times  
- Chain checkpoints under a par time  

**Why it fits:** Existing **layout-heavy** procgen or hand tracks need **minimal narrative** change; goals become **gates** and **timers**.

---

## 3. Movement: from “rolling” to “thrust”

**Redesign principle:** stop describing **rolling**; describe a **vehicle** with **thrust and inertia**.

### 3.1 Player-facing concepts

| Concept | Role |
|--------|------|
| **Forward thrust** | Primary acceleration along intent (camera-relative or drone-forward) |
| **Air braking** | Opposite thrust or drag to shed speed |
| **Strafe / drift** | Lateral thrust; may couple with slight yaw for “arcade” feel |
| **Boost burst** | Short overclock (replaces ad-hoc “jump” spikes as fantasy) |
| **Hover stabilisation** | Automatic correction toward target surface height; hides raw physics |

### 3.2 Control mapping (target)

| Input | Intended feel |
|-------|----------------|
| **WASD** (or left stick) | **Lateral** thrust / desired velocity on the hover plane (not “roll torque”) |
| **Jump** (e.g. Space) | **Upward burst** or **brief lift**, not “ball hop” |
| **Camera** (e.g. arrows) | Orbit or reframe; unchanged in role from current prototype |
| **Optional: hold jump** | Short sustained lift within **fuel** limits (see §4) |
| **Power-ups** (future) | **Temporary overclock** modules (boost, tighter brakes, extra lift) |

### 3.3 Physics feel (high level)

Prefer:

- **Smooth acceleration** toward target velocity  
- **Soft deceleration** and **slight overshoot** on direction changes  

Avoid presenting **bouncy** collisions as the main identity unless a specific fiction (e.g. cargo nets) demands it.

**Note:** The underlying integrator may still be **forces/impulses** on a rigid body; **tuning** and **UI** carry the drone fantasy.

---

## 4. Altitude as a light mechanic

Full **six-DOF flight** is **not** required for the first slice.

### 4.1 Target model

- **Default:** drone **maintains a small clearance** above underlying surfaces (e.g. **~0.5 m** nominal hover height via stabilisation or ray-based height control).  
- **Jump / burst:** short **upward impulse** or **rate-limited** vertical thrust.  
- **Optional:** **hold** to **sustain lift** for a short window, bounded by a **fuel** or **heat** meter so hover cannot replace platforming indefinitely.

### 4.2 Design goals

- Keeps **platform** readability (mostly **planar** routes with **light** vertical play).  
- Reads clearly as a **machine** managing **thrust vs gravity**, not a ball **bouncing**.  
- **Kill plane** / **out-of-bounds** still apply below the play volume.

---

## 5. Goals and level flow (cross-cutting)

- **Checkpoints** or **zones** align with maintenance, survey, or race fictions (see §2).  
- **Start / end** (or **relay chains**) remain valid **design patterns**; **names and visuals** change to **terminals**, **beacons**, **gates**, or **delivery slots**.  
- **Obstacles** (gaps, lattice decks, moving hazards) remain **valid**; they are reinterpreted as **infrastructure damage**, **missing grating**, or **hazard fields**.

---

## 6. Tone and presentation

- **Stylish satire** or **earnest sci-fi** are both compatible; align with [`THE_LADDER.md`](THE_LADDER.md) if the corporate climb theme persists, or pivot copy if fiction is **pure station-maintenance**.  
- **Audio** (future): low **thrust hum**, **brake** whine, **relay** chimes — reinforces vehicle, not marble.

---

## 7. Relation to the current codebase

Until this spec is **adopted** in [`SPEC.md`](../specs/SPEC.md):

- The **marble** prototype remains the **reference implementation** for loop, procgen, zones, and UI.  
- A **drone** pass would replace: **player collider** (sphere → capsule or box), **control law** (torque → thrust / hover controller), **copy** (menus, hints), and **tuning** (acceleration curves, vertical burst).  
- **Level descriptors** may gain **optional** fields later (e.g. `fiction`, `checkpoint` lists); not required for this document.

---

## 8. Open decisions (for a future technical spec)

- **Chosen fiction** (§2.1 vs 2.2 vs 2.3, or hybrid).  
- **Camera-relative** vs **body-forward** thrust.  
- **Fuel / heat** for sustained hover: yes/no for MVP.  
- **Multiplayer / ghosts:** out of scope unless explicitly added.

---

## 9. Revision history

| Version | Date | Notes |
|---------|------|--------|
| 1 | 2026-03-30 | Initial hover-drone redesign brief |
