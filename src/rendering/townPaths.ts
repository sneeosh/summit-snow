// Follow the same two quadratic curves as the painted main street.
export function streetPoint(t: number, pavement = 0): [number, number] {
  const second = t > .5
  const u = second ? (t - .5) * 2 : t * 2
  const [a, b, c] = second ? [[505, 442], [735, 499], [1240, 401]] : [[-40, 490], [275, 385], [505, 442]]
  return [(1-u)**2*a[0]+2*(1-u)*u*b[0]+u*u*c[0], (1-u)**2*a[1]+2*(1-u)*u*b[1]+u*u*c[1]+pavement]
}

