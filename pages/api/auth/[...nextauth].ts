import NextAuth, { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text', placeholder: 'admin' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        // Simple password check against environment variable
        const dashboardPassword = process.env.DASHBOARD_PASSWORD
        if (!dashboardPassword) {
          console.error('DASHBOARD_PASSWORD not set in environment')
          return null
        }

        // For production, hash the password in the environment
        // For now, support both plain text and hashed passwords
        let isValidPassword = false
        
        try {
          // Try comparing as hashed password first
          isValidPassword = await bcrypt.compare(credentials.password, dashboardPassword)
        } catch (error) {
          // If that fails, compare as plain text (for development)
          isValidPassword = credentials.password === dashboardPassword
        }

        if (isValidPassword && credentials.username === 'admin') {
          return {
            id: '1',
            name: 'Admin User',
            email: 'admin@voluum-dashboard.com',
          }
        }

        return null
      }
    })
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

export default NextAuth(authOptions)