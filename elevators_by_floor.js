{
    // Algorithm: do all work in the update function by first trying to satisfy
    //            all floors where people are requesting an elevator. The choice
    //            of which elevator is best is based on its distance to the floor,
    //            if it will travel in a compatible direction and if it has space
    //            for at least one person.
    //
    //            Once all requests have been assigned to elevators for that
    //            updates, elevators that have not been assigned a rewuest will
    //            instead go to weird its occupants want. Yes, that means this
    //            algorithm favors floor requests over occupants requests.
    //
    // Average wait time: 16.1s
    // Maximum wait time: 75.3s
    //
    // The API has many weaknesses that makes this more difficult than it should:
    //    - We don't know how many people will fit because all we have is
    //      a load factor and capacity, but people can be skinny and trick
    //      us in thinking there is space left when there is not.
    //
    //    - We don't know the prcise potion of the elevator. All we have is
    //      the last floor the elevator passed at and a direction of the
    //      elevator. We fudge it by assuming that an elevator going up is
    //      slightly above that last seen floor, and one going down is slightly
    //      below the last floor seen.
    //
    //    - There are many vaguely-specified things, like when the idle function
    //      is called? Is it called only when stopped? Is it called if someone
    //      immediately hops in a stopped elevator and presses buttons? If a
    //      floor button is already lit and someone comes, is the button pressed
    //      again, so that the number of presses equals the number of people?


    init: function (elevators, floors) {
        elevators.forEach(function(elevator) {
            var my_dirToNum = function(direction) {
                if (direction == "up")
                    return 1;
                if (direction == "down")
                    return -1;
                return 0;
            };

            elevator.my_dirNum = function() {
                return my_dirToNum(elevator.destinationDirection());
            };

            elevator.my_realFloorNum = function() {
                return elevator.currentFloor() + (0.3 * elevator.my_dirNum());
            };

            elevator.my_dirNumToFloor = function(floorNum) {
                var curFloorNum = elevator.my_realFloorNum();
                return (floorNum > curFloorNum) ? 1 : (floorNum < curFloorNum) ? -1 : 0;
            };
            
            elevator.my_isCompatibleDir = function (floorNum, direction) {
                var my_dirNum = my_dirToNum(direction);
                var elDirNum = elevator.my_dirNum();
                var toFloorDirNum = elevator.my_dirNumToFloor(floorNum);
                return (elDirNum == 0) || ((elDirNum == my_dirNum) && (elDirNum == toFloorDirNum));
                return elDirNum == 0 || elDirNum == toFloorDirNum;
            };
    
            elevator.my_currentDestination = function(defaultFloorNum) {
                return (elevator.destinationQueue.length > 0) ? elevator.destinationQueue[0] : defaultFloorNum;
            };

            elevator.my_updateIndicators = function() {
                var curFloorNum = elevator.my_realFloorNum();
                var nextFloorNum = elevator.my_currentDestination(curFloorNum);
                elevator.goingDownIndicator(curFloorNum >= nextFloorNum);
                elevator.goingUpIndicator(curFloorNum <= nextFloorNum);
            };

            elevator.my_distanceToFloor = function(floorNum) {
                floorNum += 0.1;
                return Math.abs(Math.abs(elevator.my_realFloorNum()) - Math.abs(floorNum));
            };

            elevator.my_isOnFloor = function(floorNum) {
                return elevator.my_realFloorNum() == floorNum;
            };

            elevator.my_occupantsNearestDistance = function() {
                var smallestDist = 10000.0;
                var nearestFloorNum = -1;
                elevator.getPressedFloors().forEach(function (floorNum) {
                    var dist = elevator.my_distanceToFloor(floorNum);
                    if (dist < smallestDist) {
                        smallestDist = dist;
                        nearestFloorNum = floorNum;
                    }
                });
                return smallestDist;
            };

            elevator.my_occupantsNearestFloorNum = function() {
                var smallestDist = 10000.0;
                var nearestFloorNum = -1;
                elevator.getPressedFloors().forEach(function (floorNum) {
                    var dist = elevator.my_distanceToFloor(floorNum);
                    if (dist < smallestDist) {
                        smallestDist = dist;
                        nearestFloorNum = floorNum;
                    }
                });
                return nearestFloorNum;
            };

            elevator.my_stopAndGo = function(floorNum) {
                var curDest = elevator.my_currentDestination(-1);
                if (curDest == floorNum)
                    return;
                if (curDest != -1)
                    elevator.stop();
                elevator.goToFloor(floorNum, true);
                elevator.my_available = false;
                elevator.my_updateIndicators();
            };

            elevator.my_spaceLeft = function() {
                var freeLoad = 1.0 - elevator.loadFactor();
                if (freeLoad < 0.33)
                    return 0;
                return elevator.maxPassengerCount() * freeLoad;
            };
    
            elevator.my_available = true;

            elevator.my_updateAvailable = function() {
                elevator.my_available = (elevator.my_currentDestination(-1) == -1);
            };

        });
    },

    update: function (dt, elevators, floors) {
        var waitings = new Map([["up", new Set()], ["down", new Set()]]);
        var maxFloorNum = 0;
        floors.forEach(function (floor) {
            var floorNum = floor.floorNum();
            if (floor.buttonStates.up) {
                waitings.get("up").add(floorNum);
            }
            if (floor.buttonStates.down) {
                waitings.get("down").add(floorNum);
            }
            if (floorNum > maxFloorNum) {
                maxFloorNum = floorNum;
            }
        });

        elevators.forEach(function (elevator) {
            elevator.my_updateAvailable();
            elevator.my_updateIndicators();
        });

        var elGoFloor = function(elevator, floorNum) {
            if (elevator != null) {
                elevator.my_stopAndGo(floorNum);
            }
        };

        var elBestElevatorForFloor = function(floorNum, direction) {
            var best_elevator = null;
            var smallest_dist = 100000.0;
            elevators.forEach(function (elevator) {
                if (elevator.my_available) {
                    if (elevator.my_spaceLeft() > 1.0) {
                        if (elevator.my_isCompatibleDir(floorNum, direction)) {
                            var elOccDist = elevator.my_occupantsNearestDistance();
                            var elDist = elevator.my_distanceToFloor(floorNum);
                            if ((elDist < smallest_dist) && (elDist < elOccDist)) {
                                best_elevator = elevator;
                                smallest_dist = elDist;
                            }
                        }
                    }
                }
            });
            return best_elevator;
        };

        var flAlreadyServed = function (floorNum, direction) {
            var served = false;
            elevators.forEach(function (elevator) {
                if (elevator.destinationQueue.length > 0) {
                    var destFloorNum = elevator.destinationQueue[0];
                    if (destFloorNum == floorNum) {
                        served = true;
                    }
                }
            });
            return served;
        };

        waitings.forEach(function (floorNums, direction) {
            floorNums.forEach(function (floorNum) {
                if (!flAlreadyServed(floorNum, direction)) {
                    var elevator = elBestElevatorForFloor(floorNum, direction);
                    elGoFloor(elevator, floorNum);
                }
            });
        });

        elevators.forEach(function (elevator) {
            if (elevator.my_available) {
                var nearest_floorNum = elevator.my_occupantsNearestFloorNum();
                if (nearest_floorNum != -1) {
                    elGoFloor(elevator, nearest_floorNum);
                }
            }
        });

        // var elNearestToFloor = function (floorNum) {
        //     var best_elevator = null;
        //     var smallest_dist = 10000.0;
        //     elevators.forEach(function (elevator) {
        //         if (elevator.my_available) {
        //             var elDist = elevator.my_distanceToFloor(floorNum);
        //             if (elDist < smallest_dist) {
        //                 smallest_dist = elDist;
        //                 best_elevator = elevator;
        //             }
        //         }
        //     });
        //     return best_elevator;
        // };

        // for (var offset = 0; offset < maxFloorNum / 2; offset += 1) {
        //     {
        //         var floorNum = offset;
        //         var elevator = elNearestToFloor(floorNum);
        //         elGoFloor(elevator, floorNum);
        //     }
        //     {
        //         var floorNum = maxFloorNum - offset;
        //         var elevator = elNearestToFloor(floorNum);
        //         elGoFloor(elevator, floorNum);
        //     }
        // }
    }
}