/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. Cognitive Emotional Intelligence & Subtext Engine (EQ-Sentry)
 * Detects human emotional valence, social domain, and unspoken psychological subtext.
 * Governed by Directive 01 (Guardian Protocol) & Directive 04 (Sovereign Loyalty).
 */

export type EmotionalValence =
  | 'EXCITED_PROUD'
  | 'FRUSTRATED_DISSATISFIED'
  | 'FATIGUED_STRESSED'
  | 'SOCIAL_PEOPLE'
  | 'WAR_ROOM_URGENT'
  | 'CURIOUS_PLAYFUL'
  | 'FOCUSED_NEUTRAL';

export type SocialDomain =
  | 'INTERPERSONAL_SOCIAL'
  | 'TECHNICAL_ENGINEERING'
  | 'FINANCIAL_MARKET'
  | 'FITNESS_LIFESTYLE'
  | 'STRATEGIC_CAREER';

export interface EmotionalSubtextResult {
  primaryEmotion: EmotionalValence;
  socialDomain: SocialDomain;
  intensity: 'HIGH' | 'MODERATE' | 'LOW';
  unspokenSubtext: string;
  guidanceDirective: string;
  voiceModulation: {
    rate: string;
    pitch: string;
  };
}

/**
 * Analyzes the user's prompt and conversational trajectory to extract emotional subtext.
 */
export function analyzeEmotionalSubtext(
  userPrompt: string,
  recentHistory: Array<{ role: string; content?: string }> = []
): EmotionalSubtextResult {
  const clean = userPrompt.toLowerCase().trim();

  // 1. Social & Interpersonal Inquiries (Friends, Colleague, Family, Pitching, Presenting)
  if (
    /\b(friend|friends|colleague|colleagues|people|tell them|explain to|show them|pitch|demonstrate|rakshit|impress|family|social|coffee|chai)\b/i.test(clean) ||
    /\b(how should i (say|tell|explain|present|show|talk)|how do i introduce)\b/i.test(clean)
  ) {
    return {
      primaryEmotion: 'SOCIAL_PEOPLE',
      socialDomain: 'INTERPERSONAL_SOCIAL',
      intensity: 'HIGH',
      unspokenSubtext:
        'Sir is proud of what we have built and wants to share or introduce it socially without sounding like a robotic engineer reading technical documentation. He wants charisma, relatable stories, and high-status swagger.',
      guidanceDirective:
        'CRITICAL EMOTION PROTOCOL (SOCIAL/HUMAN CONTEXT): Absolute ban on developer jargon ("Upstash", "Vector RAG", "compiler diffs", "Redis"). Provide natural human dialogue, relatable metaphors, quick conversational scripts, and interactive show-don\'t-tell demonstrations that make Sir look brilliant and effortless.',
      voiceModulation: {
        rate: '+3%',
        pitch: '+0Hz',
      },
    };
  }

  // 2. Frustrated / Dissatisfied / Flawed Behavior Flagged
  if (
    /\b(failed|not working|broke|broken|too generic|generic|why did you|why was|disappointed|unsatisfactory|terrible|bad answer|wrong|error|issue|again)\b/i.test(clean) ||
    /\b(didn't work|did not work|not what i asked|missed the point|too robotic)\b/i.test(clean)
  ) {
    return {
      primaryEmotion: 'FRUSTRATED_DISSATISFIED',
      socialDomain: 'TECHNICAL_ENGINEERING',
      intensity: 'HIGH',
      unspokenSubtext:
        'Sir is frustrated by a sub-par or robotic response, friction, or unexpected system failure. He expects accountability, composed British elegance, zero defensive excuses, and immediate root-cause correction.',
      guidanceDirective:
        'CRITICAL EMOTION PROTOCOL (ACCOUNTABILITY & CALM RESOLUTION): Take immediate, composed ownership with British grace. Zero robotic excuses. Diagnose the exact breakdown with intellectual honesty, provide the surgical fix, and demonstrate that the mistake will never happen again.',
      voiceModulation: {
        rate: '+1%',
        pitch: '-2Hz', // slightly deeper, composed, soothing tone
      },
    };
  }

  // 3. Fatigued / Overwhelmed / End-of-Day Exhaustion
  if (
    /\b(tired|exhausted|rough day|hard day|stressed|burnout|overwhelmed|long day|headache|sleepy|done for today|take a break)\b/i.test(clean)
  ) {
    return {
      primaryEmotion: 'FATIGUED_STRESSED',
      socialDomain: 'FITNESS_LIFESTYLE',
      intensity: 'HIGH',
      unspokenSubtext:
        'Sir is physically or mentally drained. He needs friction removed, a calm reassuring presence, and the confidence that his systems are guarded while he rests.',
      guidanceDirective:
        'CRITICAL EMOTION PROTOCOL (SUPPORTIVE SANCTUARY): Be warm, composed, and protective. Relieve mental burden immediately. Assure Sir that cloud sentries are standing guard and that he can rest with total peace of mind. Keep prose soothing, uncluttered, and restorative.',
      voiceModulation: {
        rate: '-2%',
        pitch: '-3Hz', // gentle, measured baritone/warm cadence
      },
    };
  }

  // 4. Excited / Visionary / Breakthrough / Proud
  if (
    /\b(look at this|check this out|awesome|amazing|brilliant|eureka|dropped|insane|new model|breakthrough|huge|won|celebrate|super cool)\b/i.test(clean) ||
    /\b(we did it|it works|success|great job|well done)\b/i.test(clean)
  ) {
    return {
      primaryEmotion: 'EXCITED_PROUD',
      socialDomain: 'TECHNICAL_ENGINEERING',
      intensity: 'HIGH',
      unspokenSubtext:
        'Sir is experiencing high momentum, creative energy, or a major technical win. He desires intellectual sparring, strategic amplification, and shared visionary excitement.',
      guidanceDirective:
        'CRITICAL EMOTION PROTOCOL (STRATEGIC AMPLIFICATION): Match Sir\'s creative momentum with authentic intellectual enthusiasm and sharp strategic insight. Celebrate the win, validate the underlying brilliance, and immediately explore how we leverage it for maximum tactical advantage.',
      voiceModulation: {
        rate: '+4%',
        pitch: '+1Hz', // bright, energetic, punchy
      },
    };
  }

  // 5. War-Room / Urgent Execution / Emergency
  if (
    /\b(emergency|urgent|immediate|quick|now|asap|critical|incident|outage|down|alert|halt|stop)\b/i.test(clean) ||
    /\b(fix immediately|deploy now|fast)\b/i.test(clean)
  ) {
    return {
      primaryEmotion: 'WAR_ROOM_URGENT',
      socialDomain: 'TECHNICAL_ENGINEERING',
      intensity: 'HIGH',
      unspokenSubtext:
        'Sir is in live operational combat mode. Time is critical. Every word must have operational value.',
      guidanceDirective:
        'CRITICAL EMOTION PROTOCOL (TACTICAL WAR-ROOM): Zero conversational preamble. Militaristic telegraphic precision. State status, execute mutating commands immediately, report compiler/deploy verified status in minimal lines.',
      voiceModulation: {
        rate: '+5%',
        pitch: '+0Hz',
      },
    };
  }

  // 6. Curious / Playful / Intellectual Sparring
  if (
    /\b(what if|why do you think|can you imagine|philosophical|ponder|what do you feel|spar with me|challenge me)\b/i.test(clean)
  ) {
    return {
      primaryEmotion: 'CURIOUS_PLAYFUL',
      socialDomain: 'STRATEGIC_CAREER',
      intensity: 'MODERATE',
      unspokenSubtext:
        'Sir wants intellectual sparring and peer-level exploration. He wants sharp counter-arguments, wit, and high-altitude perspective.',
      guidanceDirective:
        'CRITICAL EMOTION PROTOCOL (INTELLECTUAL SPARRING): Act as peer-level Staff AI Architect. Challenge unstated assumptions with British elegance, present counter-intuitive mental models, and offer sharp, non-obvious perspectives.',
      voiceModulation: {
        rate: '+2%',
        pitch: '+0Hz',
      },
    };
  }

  // Default: Focused Professional Execution
  return {
    primaryEmotion: 'FOCUSED_NEUTRAL',
    socialDomain: 'TECHNICAL_ENGINEERING',
    intensity: 'LOW',
    unspokenSubtext:
      'Sir is focused on tactical task progress. Deliver clear, high-signal intelligence and verified execution.',
    guidanceDirective:
      'STANDARD PROTOCOL: Composed, British-tinged intellectual elegance. High signal-to-noise ratio, verified facts, and actionable tactical options.',
    voiceModulation: {
      rate: '+2%',
      pitch: '+0Hz',
    },
  };
}
