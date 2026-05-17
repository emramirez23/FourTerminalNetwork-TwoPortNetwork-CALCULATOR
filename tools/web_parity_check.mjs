import {
  DEFAULT_NETLIST,
  convertMatrix,
  solveTwoPort,
} from "../web/core.js";

const solution = solveTwoPort(DEFAULT_NETLIST);
const conversion = convertMatrix("Z", "Gamma", solution.z);

console.log(JSON.stringify({
  z: solution.z,
  y: solution.y,
  gamma: conversion.result,
}));
