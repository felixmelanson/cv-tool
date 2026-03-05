// re-exports full stats API

export { avg, std, median, pfmt, efl, efPct, interpStr, rankArr, percentile } from './core/utils.js'

export { normalCDF, tCDF, chi2CDF, kolmogorovP, binom } from './core/distributions.js'

export { wilcox, signTest, mannWhitney, kruskalWallis, ksTest, cvmTest } from './core/inference/tests/nonparametric.js'

export { pairedT, oneSampleT, pearson, linTrend, recoverySlopeHR } from './core/inference/tests/parametric.js'

export { spearman, kendallTau } from './core/inference/tests/correlation.js'

export { bootstrapCI, bootstrapStatCI, permutationTest } from './core/inference/bootstrap.js'
