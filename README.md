CSC325 Capstone project: "Destruction Simulator"

Inspired by the spirit of the popular game "Noita" developed by Nolla
Games, as well as "Powder Game" by Dan-Ball. Our Destruction Simulator
is a 2D physics simulator where users paint a canvas with different
materials (sand, wood, water, fire, gas) and watch them interact under
simple physical rules. Powders fall, water levels, fire spreads through
flammable materials, water puts out fire and creates steam, etc.

On top of the sandbox will be a web platform where users can sign
in, save and load creations, and browse a gallery of what other people
have built.

An app like this can target educational institutions to teach kids
about basic physics and chemistry fundamentals

...or just people trying to pass the time

---------------

FIGMA LINKS
PERSONAS: https://www.figma.com/design/7FzzH3n66YKb1FPM4prG6l/Physics-Sim-Personas?node-id=11-176&t=SuTJ6pSWSGlm0TZl-0
CONTEXT DIAGRAM: https://www.figma.com/make/jcddPTptLKNJQfWEi5Hvyt/Create-context-diagram?t=qVfd0emh5eyu0qZH-0
UI: https://www.figma.com/make/xS6UxVHHr78p1nfaqF6TAL/Sandbox-Physics-Game?t=DyWKRAVRFOV7XMHe-1 

---------------

SCOPE/EPICS

The application will contain:
- A core simulation with a defined material set and interactions
- Build tools giving the player the ability to place, erase, play, pause, step, etc.
- Account system and authentication
- Save and load a creation through MongoDB
- Gallery to browse and open other users' shared creations
- AI/LLM feature? - possibly an autobuild or an interactions explainer
- Playable in the browser
- Anything else as long as we have time

The game displays a real-time cellular-automata simulation, reminiscent of Conway's Game of Life.

We need thousands of cells updating 30-60 times per second, and it has to run in the browser.
- If we pushed each frame to Django manually that would be too slow

We can split the project into 2 different parts.

The client's browser will run the simulation and UI

Django + MongoDB can handle user accounts and authentication
MongoDB can also store each user's creation as a document with scene metadata

MATERIAL EXAMPLES

Stone - An immovable material that blocks everything, acts as a wall
Sand - Falls and piles, also sinks through liquids
Water - Falls and levels, puts out fire
Fire - Spreads through flammable objects, becomes steam under water
Steam - Rises and dissipates
Wood - Burns and carries fire
Oil - Explodes if in contact with fire
and more depending on time

---------------

TEST PLAN OVERVIEW

Testing is split into two main categories, the client side simulation and the Django/Mongo backend,
with a final system test towards the end

1) Unit Tests: Simulation Engine
- The core grid update loop, material behaviors, and reactions
  Approach:
  - Build a small grid by hand (5x5, 10x10...), run the engine for N steps, compare the result to a known
    expected grid calculated by hand
  - Make sure we check properties that always hold, examples:
    a) Particle counts are conserved (ex. sand is never created or destroyed from thin air)
    b) Static materials (stone) never move.
    c) No particle can be updated over more then one tick
    d) Water in a closed container eventually must level out
  - Verify each defined interaction
    a) fire next to wood ignites it
    b) water next to fire extinguishes it
    c) etc
2) Integration Tests: API and Database
  Approach:
    - Round trip saving and loading: Save a scene through the API, load it back, confirm the returned
      document is identical to the original
    - Validation: Malformed or oversized scene documents must be rejected
    - Authentication: Protected endpoints reject unauthenticated requests, and users can't modify each others
      saved scenes
3) Final System Test
  Approach:
    - A scripted checklist of what must work before finalizations
    - Stress testing 

   
