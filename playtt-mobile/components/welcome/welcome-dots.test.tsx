import { render } from "@testing-library/react-native"

import { WelcomeDots } from "@/components/welcome/welcome-dots"

describe("WelcomeDots", () => {
  it("renders without crashing", () => {
    const { toJSON } = render(
      <WelcomeDots count={3} activeIndex={1} animate={false} />,
    )

    expect(toJSON()).toBeTruthy()
  })
})
