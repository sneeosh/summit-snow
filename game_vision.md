Here’s a prompt designed to get an advanced coding agent to build a polished, playable first version rather than just scaffolding.

Build a beautiful, browser-based ski resort tycoon and management simulation.

Working title: Summit & Snow

Product vision
Create a polished management game where the player acquires and develops a small mountain into a profitable ski resort. The player should build lifts and trails, manage snow conditions, set ticket prices, hire staff, expand amenities, respond to weather, and balance guest satisfaction against financial performance.

The game should feel like a premium modern tycoon game rather than a spreadsheet. The mountain should be visually satisfying to watch, with moving skiers, changing weather, lift activity, trail congestion, and a resort that visibly grows over time.

The experience should combine:

The accessibility and visual charm of RollerCoaster Tycoon
The operational depth of Two Point Hospital
The strategic planning of Cities: Skylines
The clean interface and atmosphere of a premium Apple-style application
The narrative unpredictability of an AI-driven simulation
Build an initial vertical slice that is genuinely playable and architected for future expansion.

Core gameplay loop
The player should repeatedly:

Review the weather forecast, snow conditions, finances, and guest demand.
Build or improve lifts, ski trails, snowmaking systems, and resort facilities.
Set operating policies, pricing, staffing, and maintenance priorities.
Open the resort for the day.
Watch guests move through the mountain and use resort services.
Respond to incidents, congestion, changing weather, and guest complaints.
Review the daily operating report.
Reinvest profits, take on financing, or prepare for upcoming conditions.
The game should progress through individual operating days within a winter season.

Initial game scope
Create one fictional mountain map with:

A base village
A beginner area
A forested intermediate section
A steep upper mountain
Several predefined lift connection points
Several potential trail corridors
A parking and arrival area
Space for future lodging and village expansion
The mountain should support clear elevation changes and visually distinct terrain zones.

The player begins with:

A limited amount of cash
One small base lodge
One surface lift or beginner chairlift
Two beginner trails
Basic ski patrol coverage
Minimal snowmaking
A small parking lot
A partially developed mountain
Simulation systems
Time
Use a compressed game clock.

Support these modes:

Paused
Normal speed
Fast speed
End day immediately
A normal operating day should take approximately five to eight real-world minutes unless accelerated.

The player should be able to build and configure the resort while paused.

Guests
Simulate individual guests or lightweight guest agents.

Each guest should have:

Name
Skill level: first-time, beginner, intermediate, advanced, or expert
Budget
Energy
Patience
Satisfaction
Preferred terrain
Risk tolerance
Group type: solo, couple, family, friends, or school group
Arrival time
Current objective
Recent memories or experiences
Guests should:

Arrive by car or shuttle
Purchase or validate tickets
Rent equipment when necessary
Choose lifts and trails appropriate to their ability
Wait in lift lines
Ski down trails
Visit restaurants, restrooms, rentals, shops, or first aid
Become tired, hungry, cold, frustrated, or delighted
Leave reviews or comments at the end of the day
Do not build a computationally expensive simulation. Use aggregation or simplified movement when necessary, but make the resort feel alive.

Trail system
Each ski trail should have:

Name
Difficulty
Length
Width
Vertical drop
Grooming status
Snow depth
Surface quality
Crowding
Scenic appeal
Tree coverage
Risk level
Open or closed status
Trail difficulties:

Green
Blue
Black
Double black
Trail conditions should affect skier speed, satisfaction, accident risk, and capacity.

Examples of trail conditions:

Fresh powder
Packed powder
Groomed
Firm
Icy
Thin coverage
Wind affected
Closed
Allow players to create trails by selecting predefined mountain corridors in the first version. Future architecture should support freeform trail drawing.

Lift system
Initial lift types:

Surface lift
Fixed-grip chairlift
High-speed detachable chairlift
Gondola
Each lift should have:

Construction cost
Hourly capacity
Ride time
Reliability
Wind tolerance
Maintenance cost
Staffing requirement
Energy usage
Queue length
Open or closed status
Guests should prefer efficient routes but may tolerate longer lines for better terrain.

Lift queues should be visually represented.

Weather and snow
Generate a multi-day weather forecast.

Weather variables:

Temperature
Snowfall
Rain
Wind speed
Visibility
Cloud cover
Freeze-thaw conditions
Weather should influence:

Natural snow accumulation
Snowmaking ability
Lift closures
Trail quality
Guest demand
Road conditions
Staff requirements
Operating costs
Weather forecast accuracy should decrease several days into the future.

Include:

Overnight snowfall
Melting
Wind redistribution
Grooming
Snowmaking
Base depth
Upper mountain depth
Snowmaking should require:

Low enough temperatures
Water capacity
Energy
Installed snow guns
Staff or automation
Facilities
Initial buildable facilities:

Ticket office
Rental shop
Ski school
Base lodge
Café
Full-service restaurant
Restroom building
Ski patrol station
First aid clinic
Maintenance garage
Parking expansion
Snowmaking pump station
Each facility should have:

Construction cost
Operating cost
Capacity
Staff requirement
Guest satisfaction effect
Revenue potential
Upgrade levels
Facilities should visibly appear on the map.

Staff
Initial staff roles:

Lift operator
Ski patroller
Groomer operator
Snowmaking technician
Rental employee
Ski instructor
Restaurant employee
Maintenance technician
Staff should have:

Wage
Skill
Morale
Schedule
Assigned location
Workload
Fatigue
For the first version, staff can be managed in aggregate by department rather than as deeply simulated individuals.

Understaffing should create visible operational consequences.

Finances
Track:

Cash
Debt
Revenue
Operating expenses
Payroll
Maintenance
Energy
Food and beverage revenue
Rental revenue
Ticket revenue
Construction spending
Interest expense
Allow the player to set:

Adult day ticket price
Child ticket price
Rental price
Ski school price
Food pricing level
Parking price
Demand should respond to pricing, weather, resort reputation, trail availability, and day of the week.

Include basic financing:

Small operating loan
Expansion loan
Interest rate
Monthly or seasonal repayment obligation
Reputation and guest satisfaction
Track overall resort reputation from zero to five stars.

Guest satisfaction should be influenced by:

Ticket value
Lift lines
Trail quality
Trail variety
Crowding
Food
Cleanliness
Staff friendliness
Weather
Parking
Safety
Scenic beauty
At the end of each operating day, generate:

Overall guest satisfaction
Most common compliments
Most common complaints
A selection of individual guest reviews
Operational highlights
Major financial results
AI-driven narrative layer
Design an AI event system, but make the game fully functional without requiring an external AI API.

Create a provider abstraction that supports:

A deterministic local event generator for development and offline play.
An optional LLM-backed event generator that can be configured later.
AI-generated content may include:

Guest reviews
Local newspaper articles
Employee requests
Contractor proposals
Weather commentary
Influencer visits
School trip inquiries
Resort partnership offers
Insurance notices
Equipment failures
Neighbor complaints
Environmental concerns
Investor communications
Every event should have structured game effects.

Example event schema:

type ResortEvent = {
  id: string;
  title: string;
  category: "guest" | "staff" | "weather" | "financial" | "safety" | "community";
  summary: string;
  body: string;
  choices: {
    id: string;
    label: string;
    description: string;
    effects: GameEffect[];
  }[];
  expiresAt?: number;
};
Do not allow freeform model output to directly modify game state. All AI output must be converted into validated structured effects.

User interface
The main game screen should include:

A large interactive mountain view
A compact top bar for cash, reputation, weather, date, and time controls
A left-side construction and management toolbar
A contextual right-side inspector panel
A collapsible bottom panel for alerts, guests, finances, and daily reports
The interface should feel elegant, calm, and premium.

Avoid:

Dense spreadsheet-like screens
Excessive modal dialogs
Cartoonishly oversized buttons
Generic admin-dashboard styling
Large blocks of text covering the mountain
Use:

Frosted glass panels sparingly
Strong typography
Subtle shadows
Snow-inspired neutral colors
Warm wood accents in village areas
Clear iconography
Smooth transitions
Responsive hover states
Small ambient animations
Mountain presentation
Use an isometric or angled top-down 2.5D mountain view.

Preferred rendering approach:

React for the application
TypeScript
PixiJS, Phaser, Three.js, or React Three Fiber for the mountain
Zustand or Redux Toolkit for state management
Tailwind CSS or a similarly consistent styling system
Choose the rendering technology that produces the best balance of visual quality, maintainability, and performance.

The mountain should show:

Elevation and terrain shading
Snow coverage
Trees
Trails
Lift towers and moving chairs
Buildings
Guest movement
Lift lines
Grooming activity
Snowmaking effects
Weather effects
Daylight changes
Do not use a flat grid as the primary view.

Use procedurally created placeholder assets or simple original vector and low-poly assets. Do not rely on copyrighted game assets.

Visual states
Provide visual overlays for:

Trail difficulty
Snow depth
Trail conditions
Guest congestion
Lift coverage
Patrol coverage
Snowmaking coverage
Financial performance
Overlays should be optional and readable without obscuring the mountain.

Construction
The player should enter build mode and select a buildable item.

For the initial version:

Buildings snap to predefined suitable zones.
Lifts connect predefined stations.
Trails use predefined corridors.
Snowmaking can be installed along eligible trails.
Construction shows a transparent preview.
Invalid placement is clearly explained.
Construction may be immediate in sandbox mode or take simulated time in standard mode.
Include undo or cancel behavior before construction is confirmed.

Onboarding
Create a short guided tutorial using contextual prompts.

Tutorial goals:

Inspect the mountain.
Build or activate a beginner lift.
Open a trail.
Hire the required staff.
Set a ticket price.
Open the resort.
Resolve the first operational problem.
Review the daily report.
Tutorial prompts should not block exploration unnecessarily.

Game modes
Implement:

Guided scenario
Start with a struggling small mountain and specific objectives.

Initial objectives:

Reach 65% guest satisfaction.
Serve 250 guests in one day.
Maintain a positive daily operating profit.
Open at least one intermediate trail.
Avoid serious safety incidents.
Sandbox mode
Provide ample money and unlocked construction options.

Save system
Support:

New game
Save game
Load game
Autosave
Reset scenario
Use local browser storage initially.

Version saved data so future schema changes can be migrated.

Technical architecture
Separate the application into:

Rendering layer
Simulation engine
Game state
Content definitions
Event system
User interface
Persistence
Optional AI provider
The simulation engine should not depend directly on React components.

Use deterministic seeded randomness so sessions can be reproduced and debugged.

Suggested structure:

src/
  app/
  components/
  game/
    simulation/
    systems/
    entities/
    economy/
    weather/
    guests/
    events/
  rendering/
  content/
  state/
  ai/
  persistence/
  utils/
Use strongly typed domain models.

Avoid placing the entire game state in one unstructured object.

Quality requirements
The project should:

Run locally with a simple install and start command
Include clear setup instructions
Avoid placeholder pages that do not function
Avoid buttons with no behavior
Avoid fake charts disconnected from simulation data
Avoid excessive hard-coded logic inside UI components
Include useful comments only where the logic is not self-explanatory
Include basic unit tests for the simulation engine
Include error boundaries and reasonable failure states
Work well on a modern desktop browser
Remain usable on a tablet, although desktop is the primary target
MVP acceptance criteria
The first complete version must allow a player to:

Start a new resort
View a visually appealing mountain
Inspect lifts, trails, guests, buildings, and conditions
Build at least four facility types
Build or activate at least three lift types
Open and close trails
Install snowmaking
Hire staff
Change ticket pricing
Advance through operating days
Experience changing weather and snow
See guests use lifts, trails, and facilities
See lift lines and trail congestion
Earn and spend money
Receive operational events
Review guest feedback
Complete scenario objectives
Save and load the game
Development approach
Work in phases, but continue implementing without waiting for approval between phases.

Phase 1: Foundation
Initialize the application.
Define domain models.
Create seeded simulation state.
Build the main layout.
Render the initial mountain.
Phase 2: Core resort simulation
Implement time.
Implement weather and snow.
Implement lifts and trails.
Implement guests.
Implement facilities.
Implement finances.
Phase 3: Interaction and management
Add building tools.
Add inspectors.
Add staffing.
Add pricing.
Add overlays.
Add alerts.
Phase 4: Game structure
Add tutorial.
Add objectives.
Add daily reports.
Add events.
Add saving and loading.
Phase 5: Visual polish
Add animations.
Improve mountain presentation.
Add weather effects.
Improve responsive behavior.
Refine typography, spacing, and interaction feedback.
Seed content
Use a fictional mountain named Mount Alder.

Example starting trails:

Bunny Hollow — Green
Pinecone Way — Green
Alder Run — Blue
North Ridge — Blue
Timberline — Black
Avalanche Chute — Double black
Example lift names:

Meadow Carpet
Alder Chair
North Ridge Express
Summit Gondola
Example village facilities:

Cedar Base Lodge
First Tracks Rentals
Timber Café
Mount Alder Ski School
Alpine Patrol Headquarters
Final output expectations
Deliver a working application, not merely a design document.

At completion:

Run the application.
Fix build, runtime, and type errors.
Test the primary gameplay loop.
Verify that save and load work.
Confirm that the game remains responsive with several hundred simulated guests.
Include a README explaining architecture, setup, controls, and major systems.
List any intentionally deferred features separately from bugs.
When choosing between adding more systems and improving the core experience, prioritize a smaller game that is attractive, understandable, stable, and fun to interact with.

A useful next iteration would be a second prompt focused entirely on the mountain’s visual direction, asset style, animations, and UI design system.