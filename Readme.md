# Elevator Saga Solutions

The [Elevator Saga](https://play.elevatorsaga.com/) is a programming challenge.
The goal is to write the control software for a set of elevators to efficiently
serve people wanting to go from floor to floor.

Multiple challenges are provided, divided into one or more categories, with
some challenges combining multiple limits.

- Time limit to move a given number of people.
- Maximum waiting time for all people.
- Maximum number of elevator-moves to serve all people.

One rapidly discovers that these limits are fighting each other. Trying to
minimize elevator-moves goes against the maximum waiting time, for example.

## Solutions

I wrote [multiple solutions](https://github.com/pierrebai/elevators) to the
challenge. I was trying to get better results, although the final attempt
turned out worse. I'll describe each one in order I wrote them below.

### Stupid

The first version I wrote and did not keep, was simply sending each elevator
to the top and bottom floor continually, stopping at floors where people were
waiting. This works only for the initial challenges. It evolved into the next
solution I wrote.

### Simple

I did not keep this version as it evolved into the next one. It was simply
responding to each floor button press by sending to it the nearest elevator.
While it worked for many challenges, it failed when trying to minimize the
number of moves or maximum waiting time.

### Elevators by requests

See: [elevators by requests](https://github.com/pierrebai/elevators/blob/main/elevators_by_requests.js)

All floor button presses are put in a queue of requests. When an elevator is
idle, it will take the closest of the two oldest requests. The algorithm does
not uses the idle function provided by the API, it reacts to button presses on
the floors an in the elevators.

Elevators will stops at intermediary floors toward their destination if there
are people requesting to go in that same direction on the floor and there is
capacity in the elevator.

This means an elevator can steals waiting people from other elevators that were
coming to pick them up. To fix this, the update function of the API periodically
cleans up both the request queue and the elevator destinations if the requests
have vanished due to other elevators picking people up en-route.

This algorithm is fair to people who already are on an elevator. Elevators
won't weirdly switch direction if they have people on board, which is in line
with how real elevators work. That seemed esthetically important to me.

### Elevators no requests

See: [elevators by requests](https://github.com/pierrebai/elevators/blob/main/elevators_by_requests.js)

I wondered if it would possible to get rid of the requests queue. Instead of
using an explicit queue, I thought I could use the set of lit-up floor buttons
themselves as the container of requests. The advantage I saw is that I would no
longer need to cleanup requests if an elevator picked someone one en-route to
another floor. I would still need to cancel other elevators already on their
way though.

Thus my aim was to simplify the book-keeping. One negative consequence though
is that requests were no longer being served in sequence. I think it makes some
challenge take more attempts to pass when there is a maximum waiting time.
Surprisingly, when there are enough elevators that turns out to be false and
this new algorithm is actually better.

On challenge #19, the perpetual challenge, it achieves an average of 12.2s with
a maximum wait time of 40.1s. Obviously these numbers can vary slightly from
run to run, but I found that the 12.2s average holds up all the time. Only
the maximum time vary, based on luck.

### Elevators by floor

Next, afyter seeing other solutuion doing this, I tried my hand at writing a
solution that did all of the work inside the update API function. This means
that the algorithm no longer reacts to button presses but dynamicslly control
the elevators continually to try to use them most efficiently as the dynamics
of movements and state of buttons change in real time.

My goal ws to try to minimize the maximum waiting time by putting absolute
priority on picking up people, at the cost of delivering them to their chosen
destination.

Thus at every time tick, the state of all floor buttons is read and we try to
send the closest elevator with spece left to it. Only if an elevator is full
or if there are no request to serve does an elevator goes to a destination
chosen by its occupants.

One consequence of this is that elevators can change course mid-way. I also
struggle to make the algorithm work, as there were many subtle bugs that would
leave elevators osciallting between two floors. Some of these bugs were logical
mistakes, but some were due to the limitations of teh API, which we  discuss in
the next section.

### Elevator Saga Problems

The API has many weaknesses that makes this more difficult than it should:

- It is not possible to know if an elevator is full. Unless an elevator is
  empty, we cannot know how many people will fit because all we have is a load
  factor and a capacity. People can be of various weight and the load factor
  is no a direct indication of how much space is left.

- We don't know the precise position of the elevator. All that the API provides
  is the last floor the elevator passed (which it calls the current floor) and
  the direction the elevator is traveling. It is possible to somewhat work
  around this by assuming that an elevator going up is slightly above the last
  seeen floor, and one going down is slightly below that last seen floor.

There are many vaguely-specified things:

- when is the idle function is called? Is it called only when stopped?
  Is it called if someone immediately hops in an elevator that just stopped
  and presses a button?
  
- If a floor button is already lit and someone comes, is the button pressed
  again, so that the number of presses equals the number of people?

- Are floors all adjacent and all floor numbers consecutive? That is, can we
  use the floor number directly as an index into the floor array?

- What counts as an elevator-move? Is stopping the elevator and queueing the
  same destination it had before considered a new move? Or are only full stops
  at a floor counted as a move?

- What is the waiting time? Is it only the time spent waiting on a floor before
  entering an elevator or is the ride time in the elevator until exit counted?

- The challenge hint that the bottom floor receives more people than other, but
  we are not given the exact average statistics. This makes tuning how much we
  should favor the bottom floor pure guess-work.

### Extra elevators functions

The code I wrote tries to be clear about what it does by adding a large number
of functions to the elevator objects and using long names for these functions.
As always, clarity is done at the cost of program length. No attempt were made
to try to fold down the functions into a mish-mash of apply/map/filter/etc.

These functions could be added to the API. Here is a short list of them,
slightly modified as they could appear in the API:

- realFloorNum(): provides the exact real-time position of the elevator, with
  fractional value when in-between floors.

- dirToFloor(floorNum): return the direction ("up", "down", "stopped") the
  elevator would need to move to reach the given floor number.

- isCompatibleDir(floorNum, direction): returns true if the current direction
  the elevator is traveling is compatible with picking people on the given
  floor wanting to go in the given direction. A stopped elevator is always
  compatible.

- willHaveDirAtFloor(floorNum, direction): returns true if the elevator will
  have the given direction at the given floor. The elevator may have other
  direrctions too. (That is, be stopped.)

- willOnlyHaveDirAtFloor(floorNum, direction): returns true if the elevator
  will only have the given direction at the given floor. The elevator must not
  have other direrctions too. (That is, it must not be stopped.)

- occupantWantToGo(floorNum): returns true if the button in the elevator for
  the given floor it lit-up, that is has been pressed.

- removeDestination(floorNum): remove the floor from the destination queue.
  
- currentDestination(defaultIfNone): returns the current destination or the
  given default if there are no destinations.

- updateIndicators(): updates the indicators based on the next destination in
  the queue. Light up both if there are no destinations.

- distanceToFloor(floorNum): returns the distance to the given floor.

- isOnFloor(floorNum): returns true if the elevator is on the given floor and
  stopped.

- occupantsNearestDistance(): distance to the nearest floor chosen by the
  occupants of the elevator, based on pressed buttons.

- occupantsNearestFloor(): nearest floor chosen by occupants of the elevator,
  based on pressed buttons.

- spaceLeft(): the approximate number of occupants that can enter the elevator
  given its capacity and load factor.

