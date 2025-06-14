"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Play, Sparkles, Zap, Clock, AlertCircle } from "lucide-react"

interface CleanedSegment {
  start: number;
  end: number;
  cleanedText: string;
}

interface ApiResponse {
  success: boolean;
  data?: {
    videoUrl: string;
    cleanedSegments: CleanedSegment[];
    totalDuration: number;
    segmentCount: number;
  };
  error?: string;
}

// Loading skeleton component
const TranscriptSkeleton = () => (
  <div className="space-y-4">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="flex items-start space-x-3">
          <div className="h-4 bg-gray-600 rounded w-24 flex-shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-600 rounded w-full"></div>
            <div className="h-4 bg-gray-600 rounded w-4/5"></div>
            {Math.random() > 0.5 && <div className="h-4 bg-gray-600 rounded w-3/4"></div>}
          </div>
        </div>
      </div>
    ))}
  </div>
)

export default function CleanScriptLanding() {
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [showEditor, setShowEditor] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [apiData, setApiData] = useState<ApiResponse | null>(null)

  const formatTranscript = (segments: CleanedSegment[]): string => {
    return segments.map((segment, index) => {
      const startTime = segment.start.toFixed(2)
      const endTime = segment.end.toFixed(2)
      return `[${index + 1}] ${startTime}s - ${endTime}s:\n   Cleaned: ${segment.cleanedText}`
    }).join('\n\n')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!youtubeUrl.trim()) return

    setIsLoading(true)
    setShowEditor(true)
    setError("")
    setTranscript("")
    setApiData(null)

    try {
      const response = await fetch(`/api/getscript?url=${encodeURIComponent(youtubeUrl)}`)
      const data: ApiResponse = await response.json()

      if (data.success && data.data) {
        setApiData(data)
        const formattedTranscript = formatTranscript(data.data.cleanedSegments)
        setTranscript(formattedTranscript)
      } else {
        setError(data.error || 'Failed to process the video')
      }
    } catch (err) {
      setError('Network error. Please try again.')
      console.error('API Error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white relative overflow-hidden">
      {/* Animated Circular Gradient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-600/30 via-purple-600/30 to-indigo-600/30 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute top-1/3 left-1/3 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-cyan-500/20 rounded-full blur-2xl animate-float"></div>
        <div className="absolute top-2/3 right-1/3 transform translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-r from-indigo-500/25 via-purple-500/25 to-pink-500/25 rounded-full blur-xl animate-float-reverse"></div>
      </div>
      
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          {/* Logo/Brand */}
          <div className="flex items-center justify-center space-x-2 mb-8">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              CleanScript
            </h1>
          </div>

          {/* Hero Text */}
          <div className="space-y-6">
            <h2 className="text-5xl md:text-7xl font-extrabold leading-tight">
              Tired of{" "}
              <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">Garbage</span>{" "}
              YouTube Transcripts?
            </h2>

            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Stop squinting at auto-generated nonsense! 🤮 <br />
              Get crystal-clear, timestamped transcripts that actually make sense.
            </p>

            <div className="flex items-center justify-center space-x-8 text-sm text-gray-400">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span>Lightning Fast</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Precise Timestamps</span>
              </div>
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>AI Powered</span>
              </div>
            </div>
          </div>

          {/* CTA Form */}
          <Card className="bg-black/20 backdrop-blur-sm border-white/10 p-8 max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="youtube-url" className="text-lg font-semibold text-left block">
                  Drop that YouTube URL and watch the magic happen ✨
                </label>
                <div className="flex space-x-3">
                  <Input
                    id="youtube-url"
                    type="url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-blue-400 focus:ring-blue-400/20"
                    required
                  />
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8 py-2 font-semibold transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Play className="w-4 h-4" />
                        <span>Try Now</span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-sm text-gray-400">
                No signup required. No credit card. Just pure transcript goodness.
              </p>
            </form>
          </Card>
        </div>
      </div>

      {/* Editor Section */}
      {showEditor && (
        <div className="container mx-auto px-4 pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              {isLoading ? (
                <>
                  <h3 className="text-3xl font-bold mb-2">Working Some Magic... ✨</h3>
                  <p className="text-gray-400">
                    Downloading, transcribing, and cleaning your video. This might take a moment.
                  </p>
                </>
              ) : error ? (
                <>
                  <h3 className="text-3xl font-bold mb-2 text-red-400">Oops! Something went wrong 😵</h3>
                  <p className="text-gray-400">
                    {error}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-3xl font-bold mb-2">Behold! Your Clean Transcript 🎉</h3>
                  <p className="text-gray-400">
                    Copy, share, or just admire how readable this is compared to YouTube's attempt
                  </p>
                  {apiData?.data && (
                    <div className="flex items-center justify-center space-x-6 mt-4 text-sm text-gray-400">
                      <span>📊 {apiData.data.segmentCount} segments</span>
                      <span>⏱️ {Math.round(apiData.data.totalDuration)}s duration</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <Card className="bg-black/40 backdrop-blur-sm border-white/10">
              <div className="border-b border-white/10 p-4">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-sm text-gray-400 ml-4">
                    {isLoading ? 'processing...' : error ? 'error.txt' : 'transcript.txt'}
                  </span>
                </div>
              </div>

              <div className="p-6">
                {isLoading ? (
                  <TranscriptSkeleton />
                ) : error ? (
                  <div className="flex items-center space-x-3 text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">{error}</span>
                  </div>
                ) : (
                  <pre className="text-sm text-gray-300 font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
                    <code>{transcript}</code>
                  </pre>
                )}
              </div>

              {!isLoading && !error && transcript && (
                <div className="border-t border-white/10 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      <span>✅ Cleaned & Formatted</span>
                      <span>⏱️ Precise Timestamps</span>
                      <span>📝 Ready to Copy</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(transcript)
                        // Optional: Add a toast notification here
                      }}
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      Copy Text
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="container mx-auto px-4 text-center text-gray-400">
          <p>Made with 💜 for people who actually want to read transcripts</p>
        </div>
      </footer>

      <style jsx>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(20px) rotate(-180deg); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-reverse {
          animation: float-reverse 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}