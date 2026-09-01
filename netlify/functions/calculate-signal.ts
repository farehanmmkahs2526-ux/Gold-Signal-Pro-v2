import { z } from 'zod'
import { error, json, rateLimit } from './_shared/http'
import { runSignal } from './_shared/signal'

const modeSchema = z.enum([
  'scalping',
  'intraday',
  'swing'
])

const tfSchema = z.record(
  z.enum([
    'M1',
    'M5',
    'M15',
    'M30',
    'H1',
    'H4',
    'Daily'
  ]),
  z.number().min(0).max(100)
)

const catSchema = z.record(
  z.string(),
  z.number().min(0).max(100)
)

const parseJson = (
  x: string | null
): unknown =>
  x ? JSON.parse(x) : undefined


const total = (
  o: Record<string, number> | undefined
): number => {

  if (!o) {
    return 100
  }

  return Object.values(o)
    .reduce(
      (a, b) => a + Number(b),
      0
    )
}


export default async (
  req: Request
) => {

  if (rateLimit(req, 30)) {
    return error(
      'Rate limit exceeded',
      429
    )
  }


  try {

    const u = new URL(req.url)


    const mode = modeSchema.parse(
      u.searchParams.get('mode') ||
      process.env.DEFAULT_SIGNAL_MODE ||
      'intraday'
    )


    const rr = Math.max(
      1,
      Math.min(
        3,
        Number(
          u.searchParams.get('rr') ||
          process.env.DEFAULT_RR ||
          2
        )
      )
    )


    const minConfidence = Math.max(
      75,
      Math.min(
        100,
        Number(
          u.searchParams.get('minConfidence') ||
          process.env.MINIMUM_CONFIDENCE ||
          75
        )
      )
    )


    const blackoutMinutes = Math.max(
      0,
      Math.min(
        180,
        Number(
          u.searchParams.get('blackoutMinutes') ||
          process.env.NEWS_BLACKOUT_MINUTES ||
          30
        )
      )
    )


    const timeframeWeights =
      tfSchema
        .optional()
        .parse(
          parseJson(
            u.searchParams.get(
              'timeframeWeights'
            )
          )
        )


    const categoryWeights =
      catSchema
        .optional()
        .parse(
          parseJson(
            u.searchParams.get(
              'categoryWeights'
            )
          )
        )


    if (
      timeframeWeights &&
      Math.abs(
        total(timeframeWeights) - 100
      ) > 0.001
    ) {

      return error(
        'Timeframe weights must total 100%',
        400
      )

    }


    if (
      categoryWeights &&
      Math.abs(
        total(categoryWeights) - 100
      ) > 0.001
    ) {

      return error(
        'Strategy-category weights must total 100%',
        400
      )

    }


    const result = await runSignal(
      mode,
      {
        riskReward: rr,
        minConfidence,
        blackoutMinutes,
        timeframeWeights,
        categoryWeights
      }
    )


    return json({
      ok: true,
      signal: result.signal,
      calendarStatus:
        result.calendarStatus
    })


  } catch (
    e: unknown
  ) {


    let message = 'Unknown error'


    if (e instanceof Error) {
      message = e.message
    }
    else if (typeof e === 'string') {
      message = e
    }


    if (
      message === 'NOT_CONFIGURED'
    ) {

      return json(
        {
          ok:false,
          configured:false,
          signal:null,
          message:
            'Live XAU/USD data is not configured. Add the required API credentials in Netlify Environment Variables.'
        },
        503
      )

    }


    return error(
      'Signal calculation failed',
      500,
      message
    )

  }

}
