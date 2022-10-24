{
    // Algorithm: all floor button presses are put in a queue of requests.
    //            When an elevator is idle, it will take the best of the two
    //            oldest requests.
    //
    //            The algorithm does not actually uses the idle function, it
    //            reacts to button presses on the floors an in the elevators.
    //
    //            Elevators will stops at intermediary floors toward their
    //            destination if there are people requesting to go in that
    //            same direction on the floor and there is capacity in the
    //            elevator.
    //
    //            Since the algorithm can make it so that an elevator thus
    //            "steals" waiting people from other elevators that were coming
    //            to service them, the update function periodically cleans up
    //            both the request queue and the elevator destinations if
    //            requests have vanished.
    //
    //            This algorithm is fair to people who already are on an
    //            elevator. Elevators won't weirdly switch direction if they
    //            have people on board, which is more in line with how real
    //            elevators work.
    //
    //            I added a large number of functions to the elevators to
    //            make the code esier to read.
    //
    // Average wait time: 12.9s
    // Maximum wait time: 40.5s

    init: function(elevators, floors) {
        var requests = [];

        var hasRequest = function (floorNum, direction) {
            return requests.indexOf([floorNum, direction]) >= 0;
        };

        var queueRequest = function (floorNum, direction) {
            if (hasRequest(floorNum, direction)) {
                return;
            }
            requests.push([floorNum, direction]);
        };

        var removeRequest = function (floorNum, direction) {
            requests = requests.filter(function (value, index, array) {
                return value[0] != floorNum || value[1] != direction;
            });
        };

        var floorByNum = new Map();

        var flHasWaiters = function(floorNum, direction) {
            var floor = floorByNum.get(floorNum);
            return (floor.buttonStates.up && direction == "up") || (floor.buttonStates.down && direction == "down");
        };

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
            };
    
            elevator.my_willOnlyHaveDirAtFloor = function(floorNum, direction) {
                var queueIndex = elevator.destinationQueue.indexOf(floorNum);
                if (queueIndex < 0)
                    return false;
                if (queueIndex == elevator.destinationQueue.length - 1)
                    return false;
                if (elevator.destinationQueue.length == 1)
                    return false;
                if (direction == "up") {
                    return elevator.destinationQueue[queueIndex] < elevator.destinationQueue[queueIndex + 1];
                }
                else {
                    return elevator.destinationQueue[queueIndex] > elevator.destinationQueue[queueIndex + 1];
                }
            };

            elevator.my_occupantWantToGo = function(floorNum) {
                return elevator.getPressedFloors().indexOf(floorNum) != -1;
            };

            elevator.my_removeDestination = function(floorNum, direction) {
                var queueIndex = elevator.destinationQueue.indexOf(floorNum);
                if (queueIndex < 0)
                    return;
                elevator.destinationQueue.splice(queueIndex, 1);
                elevator.checkDestinationQueue();
                removeRequest(floorNum, direction);
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

            // When an elevator passes by a floor, check if it can pick-up
            // some people on that floor waiting to go in the same direction.
            elevator.my_checkPassingFloor = function(floorNum, direction) {
                if (elevator.my_spaceLeft() < 0.8) {
                    return;
                }
    
                var index = elevator.destinationQueue.indexOf(floorNum);
                if (index == 0) {
                    return;
                }
    
                if (index > 1) {
                    elevator.destinationQueue.splice(index, 1)
                    elevator.goToFloor(floorNum, true);
                    return;
                }
    
                if (!flHasWaiters(floorNum, direction)) {
                    return;
                }
    
                elevator.goToFloor(floorNum, true);
                removeRequest(floorNum, direction);
            };
        });

        // When an elevator button is pressed, go to that floor.
        var elGoto = function (elevator, floorNum) {
            if (floorNum < 0)
                return;

            var curFloorNum = elevator.my_realFloorNum();

            var nextFloorNum = floorNum;
            if (elevator.destinationQueue.length > 0) {
                nextFloorNum = elevator.destinationQueue[0];
            }

            if (curFloorNum < floorNum && floorNum < nextFloorNum) {
                elevator.destinationQueue.unshift(floorNum);
            }
            else if (nextFloorNum < floorNum && floorNum < curFloorNum) {
                elevator.destinationQueue.unshift(floorNum);
            }
            else if (curFloorNum != floorNum) {
                elevator.destinationQueue.push(floorNum);
            }

            if (elevator.destinationQueue.length > 0) {
                nextFloorNum = elevator.destinationQueue[0];
                if (nextFloorNum > curFloorNum) {
                    var firstHalf = elevator.destinationQueue.filter(function (value, index, array) {
                        return value >= curFloorNum;
                    });
                    firstHalf.sort(function (a, b) { return a - b; });
                    var secondHalf = elevator.destinationQueue.filter(function (value, index, array) {
                        return value < curFloorNum;
                    });
                    secondHalf.sort(function (a, b) { return b - a; });
                    elevator.destinationQueue = firstHalf.concat(secondHalf);
                } else {
                    var firstHalf = elevator.destinationQueue.filter(function (value, index, array) {
                        return value <= curFloorNum;
                    });
                    firstHalf.sort(function (a, b) { return b - a; });
                    var secondHalf = elevator.destinationQueue.filter(function (value, index, array) {
                        return value > curFloorNum;
                    });
                    secondHalf.sort(function (a, b) { return a - b; });
                    elevator.destinationQueue = firstHalf.concat(secondHalf);
                }
                elevator.checkDestinationQueue()
            }

            elevator.my_updateIndicators();
        };

        var bestRequest = function (elevator) {
            var curFloorNum = elevator.currentFloor();
            var floorNum = -1;
            var dir = "";
            var dist = 10000;
            for (var i = 0; i < requests.length && i < 2; i += 1) {
                var reqDist = Math.abs(curFloorNum - requests[i][0]);
                if (reqDist < dist) {
                    floorNum = requests[i][0];
                    dir = requests[i][1];
                    dist = reqDist;
                }
            }
            removeRequest(floorNum, dir);
            return floorNum;
        };

        var elOnIdle = function (elevator) {
            if (requests.length > 0) {
                elGoto(elevator, bestRequest(elevator));
            } else {
                elevator.my_updateIndicators();
            }
        };


        // When the elevator stops at a floor, update its indicators and check
        // if there is work to do if it has no other destinations to go to.
        var elStoppedAtFloor = function (elevator, floorNum) {
            elevator.my_updateIndicators();

            if (elevator.destinationQueue.length < 1) {
                elOnIdle(elevator);
            }

            elevator.my_updateIndicators();
        }

        // Connect the API elevator triggers to the corresponding function.
        elevators.forEach(function (elevator) {
            elevator.on("floor_button_pressed", function (floorNum) {
                elGoto(elevator, floorNum);
            });
            elevator.on("passing_floor", function (floorNum, direction) {
                elevator.my_checkPassingFloor(floorNum, direction);
            });
            elevator.on("stopped_at_floor", function (floorNum) {
                elStoppedAtFloor(elevator, floorNum);
            });
        });

        // When a floor button is pressed, queue a request and use any elevator
        // that is idle.
        floors.forEach(function (floor) {
            floorByNum.set(floor.floorNum(), floor);

            floor.my_onButton = function (floorNum, direction) {
                queueRequest(floor.floorNum(), direction);
                elevators.forEach(function (elevator) {
                    if (elevator.destinationQueue.length == 0) {
                        elOnIdle(elevator);
                    }
                });
            };

            floor.on("up_button_pressed", function () {
                floor.my_onButton("up")
            });
            floor.on("down_button_pressed", function () {
                floor.my_onButton("down")
            });
        });
    },

    update: function(dt, elevators, floors) {
        // Cancel elevators movements toward floor that were cleared by
        // other elevators that were passing by.
        //
        // Also remove all pending requests for those floors.
        floors.forEach(function(floor) {
            var floorNum = floor.floorNum();
            if (!floor.buttonStates.up && !floor.buttonStates.down) {
                elevators.forEach(function(elevator) {
                    if (!elevator.my_occupantWantToGo(floorNum)) {
                        elevator.my_removeDestination(floorNum, "up");
                    }
                });
            }
            else if (!floor.buttonStates.up) {
                elevators.forEach(function(elevator) {
                    if (!elevator.my_occupantWantToGo(floorNum)) {
                        if (elevator.my_willOnlyHaveDirAtFloor(floorNum, "up")) {
                            elevator.my_removeDestination(floorNum, "up");
                        }
                    }
                });
            }
            else if (!floor.buttonStates.down) {
                elevators.forEach(function(elevator) {
                    if (!elevator.my_occupantWantToGo(floorNum)) {
                        if (elevator.my_willOnlyHaveDirAtFloor(floorNum, "down")) {
                            elevator.my_removeDestination(floorNum, "down");
                        }
                    }
                });
            }
        });
    }
}