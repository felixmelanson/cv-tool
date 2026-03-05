// re-exports  full stats API

export { avg, std, median, pfmt, efl, efPct, interpStr, rankArr, percentile } from './core/utils.js'

export { normalCDF, tCDF, chi2CDF, kolmogorovP, binom }             from './core/distributions.js'

export { wilcox, signTest, mannWhitney, kruskalWallis, ksTest, cvmTest } from './tests/nonparametric.js'

export { pairedT, oneSampleT, pearson, linTrend, recoverySlopeHR }  from './tests/parametric.js'

export { spearman, kendallTau }                                       from './tests/correlation.js'

export { bootstrapCI, bootstrapStatCI, permutationTest }             from './inference/bootstrap.js'