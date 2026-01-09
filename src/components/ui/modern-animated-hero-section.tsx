"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"

interface Character {
    char: string
    x: number
    y: number
    speed: number
}

class TextScramble {
    el: HTMLElement
    chars: string
    queue: Array<{
        from: string
        to: string
        start: number
        end: number
        char?: string
    }>
    frame: number
    frameRequest: number
    resolve: (value: void | PromiseLike<void>) => void

    constructor(el: HTMLElement) {
        this.el = el
        this.chars = '!<>-_\\/[]{}—=+*^?#'
        this.queue = []
        this.frame = 0
        this.frameRequest = 0
        this.resolve = () => { }
        this.update = this.update.bind(this)
    }

    setText(newText: string) {
        const oldText = this.el.innerText
        const length = Math.max(oldText.length, newText.length)
        const promise = new Promise<void>((resolve) => this.resolve = resolve)
        this.queue = []

        for (let i = 0; i < length; i++) {
            const from = oldText[i] || ''
            const to = newText[i] || ''
            const start = Math.floor(Math.random() * 40)
            const end = start + Math.floor(Math.random() * 40)
            this.queue.push({ from, to, start, end })
        }

        cancelAnimationFrame(this.frameRequest)
        this.frame = 0
        this.update()
        return promise
    }

    update() {
        let output = ''
        let complete = 0

        for (let i = 0, n = this.queue.length; i < n; i++) {
            let { from, to, start, end, char } = this.queue[i]
            if (this.frame >= end) {
                complete++
                output += to
            } else if (this.frame >= start) {
                if (!char || Math.random() < 0.28) {
                    char = this.chars[Math.floor(Math.random() * this.chars.length)]
                    this.queue[i].char = char
                }
                output += `<span class="dud">${char}</span>`
            } else {
                output += from
            }
        }

        this.el.innerHTML = output
        if (complete === this.queue.length) {
            this.resolve()
        } else {
            this.frameRequest = requestAnimationFrame(this.update)
            this.frame++
        }
    }
}

const ScrambledTitle: React.FC<{ title?: string, phrases?: string[] }> = ({
    title = "M.I.C.",
    phrases = [
        'Market Insights Center',
        'Automate Your Wealth',
        'Data-Backed Strategies',
        'Singularity Model',
        'Welcome to the Future'
    ]
}) => {
    const elementRef = useRef<HTMLHeadingElement>(null)
    const scramblerRef = useRef<TextScramble | null>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        if (elementRef.current && !scramblerRef.current) {
            scramblerRef.current = new TextScramble(elementRef.current)
            setMounted(true)
        }
    }, [])

    useEffect(() => {
        if (mounted && scramblerRef.current) {
            let counter = 0
            const next = () => {
                if (scramblerRef.current) {
                    scramblerRef.current.setText(phrases[counter]).then(() => {
                        setTimeout(next, 3000)
                    })
                    counter = (counter + 1) % phrases.length
                }
            }

            next()
        }
    }, [mounted, phrases])

    return (
        <div className="flex flex-col items-center justify-center z-30 relative pointer-events-none">
            <h1
                className="text-white text-6xl md:text-9xl font-bold tracking-tighter mb-4"
                style={{ fontFamily: 'monospace' }}
            >
                {title}
            </h1>
            <div
                ref={elementRef}
                className="text-gold text-xl md:text-3xl font-mono tracking-wider h-12"
            />
        </div>
    )
}

const RainingLetters: React.FC<{ children?: React.ReactNode; phrases?: string[] }> = ({ children, phrases }) => {
    const [characters, setCharacters] = useState<Character[]>([])
    const [activeIndices, setActiveIndices] = useState<Set<number>>(new Set())

    const createCharacters = useCallback(() => {
        // Check for window to avoid SSR issues if any, though likely client-side only
        if (typeof window === 'undefined') return [];

        const allChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"
        const charCount = 100 // Reduced count for better performance/clutter control
        const newCharacters: Character[] = []

        for (let i = 0; i < charCount; i++) {
            newCharacters.push({
                char: allChars[Math.floor(Math.random() * allChars.length)],
                x: Math.random() * 100,
                y: Math.random() * 100,
                speed: 0.2 + Math.random() * 0.5, // Slower fall speed
            })
        }

        return newCharacters
    }, [])

    useEffect(() => {
        setCharacters(createCharacters())
    }, [createCharacters])

    useEffect(() => {
        const updateActiveIndices = () => {
            const newActiveIndices = new Set<number>()
            const numActive = Math.floor(Math.random() * 5) + 2
            for (let i = 0; i < numActive; i++) {
                newActiveIndices.add(Math.floor(Math.random() * characters.length))
            }
            setActiveIndices(newActiveIndices)
        }

        const flickerInterval = setInterval(updateActiveIndices, 100)
        return () => clearInterval(flickerInterval)
    }, [characters.length])

    useEffect(() => {
        let animationFrameId: number

        const updatePositions = () => {
            setCharacters((prevChars: Character[]) =>
                prevChars.map((char: Character) => ({
                    ...char,
                    y: char.y + char.speed,
                    ...(char.y >= 100 && {
                        y: -5,
                        x: Math.random() * 100,
                        char: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"[
                            Math.floor(Math.random() * "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?".length)
                        ],
                    }),
                }))
            )
            animationFrameId = requestAnimationFrame(updatePositions)
        }

        animationFrameId = requestAnimationFrame(updatePositions)
        return () => cancelAnimationFrame(animationFrameId)
    }, [])

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 z-0 opacity-30">
                {/* Raining Characters */}
                {characters.map((char: Character, index: number) => (
                    <span
                        key={index}
                        className={`absolute transition-colors duration-100 ${activeIndices.has(index)
                            ? "text-gold font-bold animate-pulse"
                            : "text-green-400/40 font-light"
                            }`}
                        style={{
                            left: `${char.x}%`,
                            top: `${char.y}%`,
                            transform: `translate(-50%, -50%) ${activeIndices.has(index) ? 'scale(1.2)' : 'scale(1)'}`,
                            textShadow: activeIndices.has(index)
                                ? '0 0 8px rgba(255,215,0,0.8), 0 0 12px rgba(255,215,0,0.4)'
                                : 'none',
                            opacity: activeIndices.has(index) ? 1 : 0.3,
                            transition: 'color 0.1s, transform 0.1s, text-shadow 0.1s',
                            willChange: 'transform, top',
                            fontSize: activeIndices.has(index) ? '1.5rem' : '1rem'
                        }}
                    >
                        {char.char}
                    </span>
                ))}
            </div>

            <div className="absolute inset-0 z-10" />

            {/* Title */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-auto">
                <ScrambledTitle phrases={phrases} />
                {children && <div className="mt-8 animate-fade-in relative z-30">{children}</div>}
            </div>

        </div>
    )
}

export default RainingLetters
