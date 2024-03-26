import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
  //get user details form frontend
  const { username, email, fullname, password } = req.body;

  // vlaidation - not emapty
  if (
    [username, email, fullname, password].some(
      (fields) => fields?.trim() === ""
    )
  ) {
    throw new ApiError(500, "All fields are required");
  }
  console.log("email", email);
  // is user exists alerady
  const isuserpresent = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (isuserpresent) {
    throw new ApiError(500, "User exists with this email");
  }

  //getting localpath of the files //check for images and avtars
  console.log(req.files);
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  let coverImageLocalPath;

  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  if (!avatarLocalPath) {
    throw new ApiError(500, "Not found Avatar");
  }

  //upload image and avatar in cloudinary

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  // let coverImage=null;
  // if(coverImageLocalPath)
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  //  console.log("cv",coverImage)
  if (!avatar) {
    throw new ApiError(500, "Avtar not found");
  }

  //create user object entry in mongodb

  const newUser = await User.create({
    username: username.toLowerCase(),
    email,
    fullname,
    password,
    avatar: avatar.url,
    coverImage: coverImage ? coverImage.url : "",
  });

  //removing password and refersh token from response
  const user = await User.findById(newUser._id).select(
    "-password -refreshToken"
  );

  //check for user creation
  console.log(user);
  if (!user) {
    throw new ApiError(
      500,
      "Something went worng while registering the user!!"
    );
  }

  //return res
  return res
    .status(201)
    .json(new ApiResponse(200, user, "User Registerd Successfully"));
});

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generation refersh and access token"
    );
  }
};

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  if (!username || !email) {
    throw new ApiError(400, "username or eamil is required!!");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(500, "User does not exist!!");
  }

  const passwordCheck = await user.isPasswordCorrect(password);

  if (!passwordCheck) {
    throw new ApiError(500, "Invalid user credential");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInuser = await user
    .findById(user._id)
    .select("-password -refreshToken");

  //sending cookies

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(201)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInuser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

export { registerUser, loginUser };
