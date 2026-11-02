import {
  appleSpring,
  nearestSnapPoint,
  projectMomentum,
  rubberband,
  spring,
} from "@/constants/motion"

jest.mock("react-native-reanimated", () => require("@/test/reanimated-mock"))

describe("appleSpring", () => {
  it("converts response and damping ratio like SwiftUI", () => {
    const config = appleSpring({ response: 0.4, dampingRatio: 1 })
    expect(config.mass).toBe(1)
    expect(config.stiffness).toBeCloseTo(246.74, 2)
    expect(config.damping).toBeCloseTo(31.42, 2)
  })

  it("is critically damped at ratio 1", () => {
    const { mass, stiffness, damping } = appleSpring({ response: 0.3, dampingRatio: 1 })
    expect(damping!).toBeCloseTo(2 * Math.sqrt(stiffness! * mass!), 6)
  })
})

describe("spring", () => {
  it("carries release velocity only when given", () => {
    expect(spring("sheet")).not.toHaveProperty("velocity")
    expect(spring("sheet", 1200).velocity).toBe(1200)
  })
})

describe("projectMomentum", () => {
  it("uses Apple's exponential deceleration", () => {
    expect(projectMomentum(1000)).toBeCloseTo(499, 0)
    expect(projectMomentum(-500, 0.99)).toBeCloseTo(-49.5, 1)
  })
})

describe("rubberband", () => {
  it("follows less the further past the edge", () => {
    const small = rubberband(20, 400)
    const large = rubberband(200, 400)
    expect(small).toBeLessThan(20)
    expect(large / 200).toBeLessThan(small / 20)
    expect(rubberband(-200, 400)).toBeCloseTo(-large, 6)
  })
})

describe("nearestSnapPoint", () => {
  it("picks the stop closest to the projected position", () => {
    expect(nearestSnapPoint(330, [0, 300, 600])).toBe(300)
    expect(nearestSnapPoint(480, [0, 300, 600])).toBe(600)
  })
})
