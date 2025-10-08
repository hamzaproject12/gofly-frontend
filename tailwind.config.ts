import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
		keyframes: {
			'accordion-down': {
				from: {
					height: '0'
				},
				to: {
					height: 'var(--radix-accordion-content-height)'
				}
			},
			'accordion-up': {
				from: {
					height: 'var(--radix-accordion-content-height)'
				},
				to: {
					height: '0'
				}
			},
			shake: {
				'0%, 100%': { transform: 'translateX(0)' },
				'10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
				'20%, 40%, 60%, 80%': { transform: 'translateX(4px)' }
			},
			float: {
				'0%, 100%': { transform: 'translateY(0px)' },
				'50%': { transform: 'translateY(-20px)' }
			},
			'plane-fly': {
				'0%': { transform: 'translateX(-100px) translateY(0px)', opacity: '0' },
				'10%': { opacity: '0.6' },
				'90%': { opacity: '0.6' },
				'100%': { transform: 'translateX(calc(100vw + 100px)) translateY(-50px)', opacity: '0' }
			},
			'plane-fly-slow': {
				'0%': { transform: 'translateX(-100px) translateY(0px)', opacity: '0' },
				'10%': { opacity: '0.4' },
				'90%': { opacity: '0.4' },
				'100%': { transform: 'translateX(calc(100vw + 100px)) translateY(-80px)', opacity: '0' }
			},
			twinkle: {
				'0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
				'50%': { opacity: '1', transform: 'scale(1.2)' }
			},
			gradient: {
				'0%, 100%': { backgroundPosition: '0% 50%' },
				'50%': { backgroundPosition: '100% 50%' }
			},
			'slide-up': {
				'0%': { transform: 'translateY(30px)', opacity: '0' },
				'100%': { transform: 'translateY(0)', opacity: '1' }
			}
		},
		animation: {
			'accordion-down': 'accordion-down 0.2s ease-out',
			'accordion-up': 'accordion-up 0.2s ease-out',
			shake: 'shake 0.5s ease-in-out',
			float: 'float 6s ease-in-out infinite',
			'plane-fly': 'plane-fly 15s linear infinite',
			'plane-fly-slow': 'plane-fly-slow 25s linear infinite',
			twinkle: 'twinkle 3s ease-in-out infinite',
			gradient: 'gradient 8s linear infinite',
			'slide-up': 'slide-up 0.6s ease-out'
		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
