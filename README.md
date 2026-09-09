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

The game displays a realtime cellular-automata simulation, reminiscent of Conway's Game of Life.

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
