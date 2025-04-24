// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SequentialSteps {
    enum Step { NotStarted, StepOneDone, StepTwoDone, Completed }
    Step public currentStep;

    address public owner;

    event StepCompleted(string step);

    constructor() {
        owner = msg.sender;
        currentStep = Step.NotStarted;
    }

    function stepOne() public {
        require(currentStep == Step.NotStarted, "Step One already done or out of order");
        
        // Add logic for step one here
        currentStep = Step.StepOneDone;
        emit StepCompleted("Step One");
    }

    function stepTwo() public {
        require(currentStep == Step.StepOneDone, "Step Two out of order");

        // Add logic for step two here
        currentStep = Step.StepTwoDone;
        emit StepCompleted("Step Two");
    }

    function stepThree() public {
        require(currentStep == Step.StepTwoDone, "Step Three out of order");

        // Add logic for step three here
        currentStep = Step.Completed;
        emit StepCompleted("Step Three");
    }
}