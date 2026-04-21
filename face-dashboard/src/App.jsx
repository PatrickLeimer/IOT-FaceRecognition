import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import LiveFeed from './pages/LiveFeed'
import People from './pages/People'
import Enroll from './pages/Enroll'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"       element={<LiveFeed />} />
        <Route path="/people" element={<People />} />
        <Route path="/enroll" element={<Enroll />} />
      </Routes>
    </Layout>
  )
}
