import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const lower = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

export class RegisterDto {
  @ApiProperty({ example: 'Nile Foods Trading' })
  @trim()
  @IsString()
  @Length(2, 120)
  businessName: string;

  @ApiProperty({ example: 'Ahmed Hassan' })
  @trim()
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiProperty({ example: 'owner@example.com' })
  @lower()
  @IsEmail()
  @MaxLength(190)
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'owner@demo.tradeflow.local' })
  @lower()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
