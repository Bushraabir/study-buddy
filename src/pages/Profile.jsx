import React, { useEffect, useState, Suspense } from "react";
import styled from "styled-components";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../components/firebase";
import { motion } from "framer-motion";

// Styled Components
const ProfileContainer = styled.div`
  background: #1a1a1a;
  color: #e4e4e7;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  border-radius: 12px;
  padding: 30px;
  max-width: 1100px;
  width: 95%;
  margin: 50px auto;
  display: flex;
  flex-direction: row; /* Align elements side-by-side */
  gap: 20px;
  overflow: hidden;
`;

const InfoContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column; /* Stack child elements vertically */
  justify-content: space-between; /* Push the button to the bottom */
  text-align: left;

  h1 {
    font-size: 2.5rem;
    font-family: "Dancing Script", cursive;
    color: #ffffff;
    margin-bottom: 20px;
  }

  p {
    font-size: 1.2rem;
    color: #a8a8b3;
    margin: 10px 0;
  }

  .logout-button {
    background: linear-gradient(135deg, #5a67d8, #7f89e5);
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    padding: 12px 24px;
    cursor: pointer;
    margin-top: auto; /* Push button to the bottom */
    box-shadow: 0 4px 15px rgba(90, 103, 216, 0.3);
    transition: all 0.3s ease-in-out;

    &:hover {
      transform: translateY(-5px);
      background: linear-gradient(135deg, #7f89e5, #5a67d8);
      box-shadow: 0 6px 20px rgba(90, 103, 216, 0.5);
    }
  }
`;

const ModelContainer = styled.div`
  flex: 1;
  height: 600px;
`;

const GLTFModel = ({ modelPath }) => {
  const gltf = useLoader(GLTFLoader, modelPath);
  return <primitive object={gltf.scene} scale={0.02} />;
};

const LoadingFallback = () => (
  <mesh>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="gray" />
  </mesh>
);

function Profile() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      alert("You have been logged out.");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (!user) {
    return (
      <ProfileContainer>
        <h3>Please log in to view your profile.</h3>
      </ProfileContainer>
    );
  }

  return (
    <ProfileContainer>
      {/* Left Side: User Information */}
      <InfoContainer>
        <motion.h1
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          Welcome, {userData?.name || "User"}!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          Email: {userData?.email || user.email}
        </motion.p>
        <motion.p
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          Account Created:{" "}
          {userData?.createdAt?.toDate().toLocaleString() || "Unknown"}
        </motion.p>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1, type: "spring", stiffness: 120 }}
          style={{
            background: "linear-gradient(135deg, #5a67d8, #7f89e5)",
            color: "#ffffff",
            padding: "15px 20px",
            borderRadius: "12px",
            margin: "20px 0",
            fontWeight: "600",
            fontSize: "1.5rem",
          }}
        >
          Total Time Today: {userData?.totalTimeToday || "0 seconds"}
        </motion.div>

        <motion.button
          onClick={handleLogout}
          className="logout-button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          Logout
        </motion.button>
      </InfoContainer>

      {/* Right Side: 3D Model */}
      <ModelContainer>
  <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
    {/* Ambient and Point Lights */}
    <ambientLight intensity={0.5} />
    <pointLight position={[10, 10, 10]} />
    
    {/* OrbitControls to focus on the face */}
    <OrbitControls
      target={[0, 1.5, -1]} // Adjust target closer to the face level
      maxPolarAngle={Math.PI / 2} // Restrict rotation angle
      minPolarAngle={Math.PI / 3} // Prevent excessive upward tilt
      enablePan={false} // Lock camera to prevent unwanted panning
    />
    
    {/* Load 3D Model */}
    <Suspense fallback={<LoadingFallback />}>
      <GLTFModel modelPath="/src/assets/pikachu/scene.gltf" />
    </Suspense>
  </Canvas>
</ModelContainer>


    </ProfileContainer>
  );
}

export default Profile;
