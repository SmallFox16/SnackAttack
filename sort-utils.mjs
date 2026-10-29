/**
 * Return vending machines ordered from nearest to farthest using a Map keyed
 * by machine ID. Machines without a finite distance are kept at the end in
 * their original relative order. The input array is never mutated.
 */
export function sortMachinesByDistance(machines, distancesByMachine) {
  return machines
    .map((machine, index) => ({
      machine,
      index,
      distance: distancesByMachine.get(String(machine.ID))
    }))
    .sort((a, b) => {
      const aHasDistance = Number.isFinite(a.distance);
      const bHasDistance = Number.isFinite(b.distance);

      if (aHasDistance && bHasDistance) {
        const difference = a.distance - b.distance;
        return difference !== 0 ? difference : a.index - b.index;
      }
      if (aHasDistance) return -1;
      if (bHasDistance) return 1;
      return a.index - b.index;
    })
    .map(({ machine }) => machine);
}
