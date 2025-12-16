"use strict";

//#region Classes (these are here, rather than another file, for intellisense)

//#region Debug

/**
 * Whether or not debug mode is enabled
 * @type {boolean}
 */
let debugEnabled = false;

/**
 * The thickness of the collider outline
 * @type {number}
 */
const DEBUG_COLLIDER_THICKNESS = 2;

/**
 * An object that holds all the debug elements
 * Cleared each frame for frame based debug elements
 */
class Debug extends PIXI.Container
{
    /**
     * Creates a new Debug object and adds it to the scene
     */
    constructor()
    {
        super();

        //Add listener for toggling debug when '/' is pressed
        document.onkeydown = e =>
        {
            e.preventDefault();
            if(e.key === "/") debugEnabled = !debugEnabled;
        };
    }

    /**
     * Updates the debug elements and clears previous frame
     */
    update()
    {
        //Clear the debug elements for this frame
        this.removeChildren();

        //Stop debugging if not enabled
        if(!debugEnabled) return;

        //Collider
        this.drawColliders();
    }

    /**
     * Draws the colliders for all objects
     */
    drawColliders()
    {
        //Draw colliders for all objects
        for(const physObj of OBJECTS)
        {
            //Draw circle outline
            const colliderGraphic = new PIXI.Graphics();
            colliderGraphic.beginFill(0x00000, 0);
            colliderGraphic.lineStyle(DEBUG_COLLIDER_THICKNESS, 0xff0000);
            colliderGraphic.drawCircle(physObj.x, physObj.y, physObj.colliderRadius);
            colliderGraphic.endFill();

            //Add drawing to the containter
            this.addChild(colliderGraphic);
        }

        //Draw player fling vector
        const aimingVisualization = new PIXI.Graphics();
        aimingVisualization.lineStyle(DEBUG_COLLIDER_THICKNESS, 0x00ff00);
        aimingVisualization.lineTo(PLAYER.flingForce.x, PLAYER.flingForce.y);
        aimingVisualization.position.set(PLAYER.x, PLAYER.y);
        this.addChild(aimingVisualization);

        //Draw wave collider
        const waveColliderGraphic = new PIXI.Graphics();
        waveColliderGraphic.beginFill(0x00000, 0);
        waveColliderGraphic.lineStyle(DEBUG_COLLIDER_THICKNESS, 0x00fff0);
        waveColliderGraphic.drawRect(WAVE.bounds.x, WAVE.bounds.y, WAVE.bounds.width, WAVE.bounds.height);
        waveColliderGraphic.endFill();
        this.addChild(waveColliderGraphic);
    }
}

/**
 * The debug object for the game
 */
const DEBUG = new Debug();

//#endregion

/**
 * An object with basic physics and is a graphics object
 * @abstract
 */
class PhysicsObject extends PIXI.Graphics
{
    /**
     * Creates a new PhysicsObject
     * @param {Function} setupVisual A function of what to draw, requires 1 arg of PhysicsObject
     * @param {Victor} vectorPosition The initial position (not for the visual, for the entire object)
     * @param {number} tint The color of the tint
     */
    constructor(setupVisual, vectorPosition = Victor(0, 0), tint = 0xffffff)
    {
        super();

        // --Properties
        
        //-Collider
        /**
         * The collider radius of the base visual
         * @type {number}
         */
        this.baseColliderRadius = 1;

        /**
         * The collider radius of the complete physics object
         * aka the base collider * scale
         * @type {number}
         */
        this.colliderRadius = 1;

        //-Physics
        /**@type {Victor}*/this.vectorPosition = vectorPosition;
        /**@type {Victor}*/this.velocity = Victor(0, 0);
        /**@type {Victor}*/this.momentOfAcceleration = Victor(0, 0);

        //Set the color
        super.tint = tint;

        //Setup visual
        setupVisual(this);

        //Add to the list of objects
        OBJECTS.push(this);
    }

    /**
     * Preforms anything that needs to be run every frame
     */
    update()
    {
        //Basic physics
        this.velocity.add(this.momentOfAcceleration.clone().multiplyScalar(timeSpeed));
        this.vectorPosition.add(this.velocity.clone().multiplyScalar(timeSpeed));

        //Apply "friction"
        this.velocity.subtract(this.velocity.clone().multiplyScalar(FRICTION * timeSpeed));

        //Reset acceleration
        this.momentOfAcceleration = Victor(0, 0);

        //Update the base pixi properties
        this.updatePosition();
    }

    /**
     * Updates this object's base pixi position with vector position
     */
    updatePosition()
    {
        this.position.set(this.vectorPosition.x, this.vectorPosition.y);
    }

    /**
     * Checks if this object collides with another
     * @param {PhysicsObject} other The physics object to check collision with 
     * @returns {boolean} TRUE if the objects are colliding
     */
    isColliding(other)
    {
        return isColliding(this.vectorPosition, this.colliderRadius,
            other.vectorPosition, other.colliderRadius)
    }

    /**
     * Returns whether or not this object is colliding with the specified point
     * @param {Victor} point The vector position of the point to check collision with
     * @returns {boolean} TRUE if the point is colliding with this object
     */
    isCollidingWithPoint(point)
    {
        return isCircleCollidingWithPoint(this.vectorPosition, this.colliderRadius, point);
    }

    /**
     * Sets the scale of the object and computes the collider radius
     * @param {number} scale The scale amount to set the object to
     */
    setScale(scale)
    {
        super.scale.set(scale);
        this.colliderRadius = this.baseColliderRadius * scale;
    }

    /**
     * Returns the scale of the object as a number (x component)
     * @returns {number} The scale of the object as a number
     */
    getScale()
    {
        return super.scale.x;
    }
}

//#region Obstacles

/**
 * General physics objects that are procedurally placed such as orbs or spikes
 * @abstract
 */
class Obstacle extends PhysicsObject
{
    /**
     * Creates a new Obstacle
     * @param {Function} setupVisual A function of what to draw, requires 1 arg of PhysicsObject
     * @param {Victor} vectorPosition The initial position (not for the visual, for the entire object)
     * @param {number} colliderRadius The radius of the circle collider
     * @param {number} tint The color of the tint
     */
    constructor(setupVisual, vectorPosition = Victor(0, 0), colliderRadius = 1, tint = 0xffffff)
    {
        super(setupVisual, vectorPosition, tint);

        //Set the collider radius
        super.baseColliderRadius = colliderRadius;
        //Comput the collider radius
        super.setScale(1);

        //Add to obstacle list
        OBSTACLES.push(this);
    }

    /**
     * Updates this obstacle
     */
    update()
    {
        this.updatePosition();
        
        //Check if too low
        if(this.vectorPosition.y > WAVE.y + 100)
        {
            //Respawn
            this.respawn(CAMERA.nextCameraBound);
        }
    }

    /**
     * Respawns this obstacle at a random location within the specified bounds with a random scale
     * @param {PIXI.Rectangle} bounds The bounds to position this obstacle
     * @param {number} scaleMin The minimum scale used to generate the random scale
     * @param {number} scaleMax The maximum scale used to generate the random scale
     */
    respawn(bounds, scaleMin, scaleMax)
    {
        //Set a random position within the bounds
        this.vectorPosition = randomRange2D(bounds);
        //Update the base pixi pos or else there is a frame lag
        this.updatePosition();

        //Set a random scale
        this.setScale(randomRange(scaleMin, scaleMax));
    }

    /**
     * Destroys this obstacle then respawns it
     * @param {PIXI.Rectangle} bounds The bounds to respawn this obstacle in
     * @param {Function} particleEffect The particle effect to play when this obstacle is destroyed
     */
    destroy(bounds, particleEffect)
    {
        //Play particle effect
        particleEffect(this);

        //Respawn
        this.respawn(bounds);
    }
}

/**
 * The amount to boost the player by when they hit an orb
 * @type {number}
 */
const ORB_BOOST_MULTIPLIER = 1.2;

/**
 * A friendly object that adds flings and gives a boost
 */
class Orb extends Obstacle
{
    /**
     * Creates a new Orb
     * @param {Victor} vectorPosition The initial position (not for the visual, for the entire object)
     * @param {number} visualRadius The radius of the circle being drawn
     * @param {number} colliderRadius The radius of the circle collider
     * @param {number} tint The color of the circle
     */
    constructor(vectorPosition = Victor(0, 0), visualRadius = 20, colliderRadius = visualRadius*2, tint = 0x00ff00)
    {
        //Call the base constructor where it draws a circle
        super(phys =>
        {
            phys.beginFill(0xffffff);
            phys.drawCircle(0, 0, visualRadius);
            phys.endFill();
        }, vectorPosition, colliderRadius, tint);

        //Add to the list of orbs
        ORBS.push(this);
    }

    /**
     * Respawns this orb at a random location within the specified bounds with a random scale
     * @param {PIXI.Rectangle} bounds The bounds to position this orb in
     */
    respawn(bounds)
    {
        super.respawn(bounds, 0.5, 1);
    }

    /**
     * Destroys and respawns this orb
     * @param {PIXI.Rectangle} bounds The bounds to respawn the orb within
     */
    destroy(bounds)
    {
        //TODO: Particle effect
        super.destroy(bounds, physObj =>
        {
            
        });

        //Play sound
        playSound(SFX_ID.Orb);
    }
}

/**
 * A spike that subtracts flings and bounces the player back
 */
class Spike extends Obstacle
{
    /**
     * Creates a new Spike with the specified values
     * @param {Victor} vectorPosition The initial position (not for the visual, for the entire object)
     * @param {number} scaleAmount The amount to scale the initial visual by
     * @param {number} colliderRadius The radius for the collider
     * @param {number} tint The color of the spike
     */
    constructor(vectorPosition = Victor(0, 0), scaleAmount = 75, colliderRadius = scaleAmount*0.3, tint = 0xff4500)
    {
        super(phys =>
        {
            //Create a triangle centered around 0,0
            const halfScale = scaleAmount * 0.5;
            phys.beginFill(0xffffff);
            phys.drawPolygon([0, -halfScale, -halfScale, scaleAmount*0.333, halfScale, scaleAmount*0.333]);
            phys.endFill();
        }, vectorPosition, colliderRadius, tint);

        //Add to the list of spikes
        SPIKES.push(this);
    }

    /**
     * Respawns the spike at a random location within the specified bounds with a random scale
     * @param {PIXI.Rectangle} bounds The bounds to position the spike in
     */
    respawn(bounds)
    {
        super.respawn(bounds, 0.5, 1);

        //Set a random rotation
        super.rotation = random(TWO_PI);
    }

    /**
     * Destroys and respawns this spike
     * @param {PIXI.Rectangle} bounds The bounds to respawn the spike within
     */
    destroy(bounds)
    {
        //TODO: Particle effect
        super.destroy(bounds, physObj =>
        {
            
        });

        //Play sound
        playSound(SFX_ID.Orb);
        playSound(SFX_ID.Spike);
    }
}

//#endregion

//#region Player

/**
 * An "enum" for the player states
 */
const PLAYER_STATE = Object.freeze({ Dead: 0, Idle: 1, Aiming: 2 , Tutorial: 3});

/**
 * The amount of aiming balls to show.
 * Should be an even number so that the middle is the indicator
 * @type {number}
 */
const AIMING_BALLS_AMOUNT = 4;

/**
 * The inverse of the total aiming indicators. Used for quick lerping
 * @type {number}
 */
const INV_TOTAL_AIM_INDICATORS = 1 / (AIMING_BALLS_AMOUNT + 1);

/**
 * The min (x) and max (y) scale for the aiming balls
 */
const AIM_INDICATOR_SCALE_RANGE = Victor(0.2, 1.2);

/**
 * The minimum fling force to fling
 */
const FLING_FORCE_MIN = 3500;

/**
 * The amount of flings to start with
 */
const STARTING_FLINGS = 5;

/**
 * The player of the game
 */
class Player extends PhysicsObject
{
    /**
     * Creates a new Player with the specified values
     * @param {Victor} vectorPosition The initial position (not for the visual, for the entire object)
     * @param {number} scaleAmount Amount to scale the initial visual by
     * @param {number} colliderRadius The radius for the collider
     * @param {number} tint The color of the player
     */
    constructor(vectorPosition = CAMERA_POSITION_DEFAULT.clone(), scaleAmount = 20, colliderRadius = scaleAmount*0.5, tint = 0x0000ff)
    {
        super(phys =>
        {
            //Create square centered around 0,0
            phys.beginFill(0xffffff);
            const negativeHalfScale = scaleAmount*-0.5;
            //Kind of weird how this uses x2 and y2 for the position (starts from the bottom right)
            phys.drawRect(negativeHalfScale, negativeHalfScale, scaleAmount, scaleAmount);
            phys.endFill();
        }, vectorPosition, tint);

        //Properties
        /**
         * The state of the player represented by the PLAYER_STATE enum
         * @type {number}
         */
        this.playerState = PLAYER_STATE.Dead;

        /**@type {number}*/this.flings = 0;

        /**
         * The direction to fling
         * @type {Victor}
         */
        this.flingForce = Victor(0, 0);

        //Initialize aiming indicators
        this.initializeAimingIndicator();

        //Set position
        super.vectorPosition = vectorPosition;

        //Set the collider radius
        super.baseColliderRadius = colliderRadius;

        //Comput the collider radius
        this.setScale(1);
    }

    /**
     * Resets the player to the starting values
     */
    reset()
    {
        this.playerState = PLAYER_STATE.Tutorial;
        this.vectorPosition = CAMERA_POSITION_DEFAULT.clone();
        this.velocity = Victor(0, 0);
        this.setFlingAmount(STARTING_FLINGS);
        this.flingForce = Victor(0, 0);
    }

    //#region Aim Indicator

    /**
     * Initializes the aiming indicator graphics
     */
    initializeAimingIndicator()
    {
        /**
         * The list of aiming indicators in the order they are lerped
         * @type {any[]}
         */
        this.aimingIndicatorList = [];

        /**
         * The container for the little balls and number that are used to visualize your fling force
         * @type {PIXI.Container}
         */
        this.aimingIndicator = new PIXI.Container();
        this.aimingIndicator.visible = false;
        STAGE.addChild(this.aimingIndicator);

        /**
         * The thing that goes between the aiming balls and shows how many flings you have left
         * @type {PIXI.Text}
         */
        this.aimingNumber = this.createAimingNumber();

        //Calculate how many balls should be on each side of the number
        const halfBalls = Math.floor(AIMING_BALLS_AMOUNT * 0.5);

        //Initialize aiming indicators (balls, number, balls)
        this.addAimingBalls(halfBalls);        
        this.aimingIndicatorList.push(this.aimingNumber);
        this.addAimingBalls(halfBalls);

        //Add number to the container at the end so it is on top
        this.aimingIndicator.addChild(this.aimingNumber);
    }

    /**
     * Creates a new aiming ball graphic
     * @returns {PIXI.Graphics} The aiming ball graphic
     */
    createAimingBall()
    {
        const ball = new PIXI.Graphics();
        ball.beginFill(0xffff00);
        ball.drawCircle(0, 0, 10);
        ball.endFill();
        return ball;
    }

    /**
     * Adds the specified amount of aiming balls to the indicator container and list
     * @param {number} amount The amount of aiming balls to add
     */
    addAimingBalls(amount)
    {
        for(let i = 0; i < amount; i++)
        {
            const ball = this.createAimingBall();
            this.aimingIndicator.addChild(ball);
            this.aimingIndicatorList.push(ball);
        }
    }

    /**
     * Creates a new aiming number graphic
     * @returns {PIXI.Text} The number graphic
     */
    createAimingNumber()
    {
        const numberGraphic = new PIXI.Text("0", BOLD_TEXT_STYLE);
        numberGraphic.anchor.set(0.5);
        numberGraphic.scale.set(0.01);
        return numberGraphic;
    }

    /**
     * Styles the indicator when a fling is invalid
     */
    styleInvalidFling()
    {
        //Tint all indicators red
        const invalidColor = 0xff0000;
        for(const indicator of this.aimingIndicatorList)
        {
            indicator.tint = invalidColor;
            indicator.alpha *= 0.5;
        }
    }

    //#endregion

    /**
     * Bounces the player off the specified bound
     * @param {number} bound The bound to bounce off of
     */
    bounce(bound)
    {
        this.vectorPosition.x = bound;
        this.velocity.x *= -1;
        playSound(SFX_ID.Back);
    }

    /**
     * Sets the fling amount to the specified amount
     * @param {number} amount The amount of flings to set it to
     */
    setFlingAmount(amount)
    {
        //Clamp the amount
        if(amount < 0) amount = 0;

        //Set the amount
        this.flings = amount;

        //Update the number indicator
        this.aimingNumber.text = amount.toString();
    }

    //#region FSM

    /**
     * Updates this player
     */
    update()
    {
        //Face where the player is moving
        this.rotation = this.velocity.angle();  
        //Stretch based on speed
        this.scale.set(1, lerp(0.65, 1, Math.min(Math.max(0, 1 - this.velocity.lengthSq() * 0.000001), 1)));  

        //FSM kind of, but transitions are activated by events
        switch(this.playerState)
        {
            case PLAYER_STATE.Dead:
                this.whenDead();
                break;
            case PLAYER_STATE.Idle:
                this.whenAlive();
                break;
            case PLAYER_STATE.Aiming:
                this.whenAlive();
                this.whenAim();
                break;
            case PLAYER_STATE.Tutorial:
                this.whenTutorial();
                break;
        }


        //Apply gravity
        this.momentOfAcceleration.add(GRAVITY.clone().multiplyScalar(timeSpeed));

        //Bounce off the walls
        if(this.vectorPosition.x < CAMERA.boundingRectangle.left) this.bounce(CAMERA.boundingRectangle.left);
        else if(this.vectorPosition.x > CAMERA.boundingRectangle.right) this.bounce(CAMERA.boundingRectangle.right);

        super.update();
    }

    //#region Aim

    /**
     * Starts aiming the player, fsm transition
     */
    onAim()
    {
        //If the player is dead, don't aim
        if(this.playerState === PLAYER_STATE.Dead) return;

        //Play sound
        playSound(SFX_ID.Aim);

        //Change time speed
        targetGameSpeed = 0.02;

        //Show aiming indicators
        this.aimingIndicator.visible = true;

        //Change state
        this.playerState = PLAYER_STATE.Aiming;
    }

    /**
     * Aiming tasks to be run every frame
     */
    whenAim()
    {
        //Calculate fling force for this frame
        this.flingForce = mouseDownCanvasPosition.clone().subtract(mouseCanvasPosition);

        //Ease to the last indicator ball position in world space (not container space)
        CAMERA.easeTo(
            toVector(this.aimingIndicatorList[this.aimingIndicatorList.length - 1]).add(this.vectorPosition),
            CAMERA_ZOOM_AIMING, CAMERA_AIMING_EASING_FACTOR);

        //Update aiming indicators, if invalid, return
        if(this.updateAimingIndicator()) return;

        //Set direction to fling
        this.rotation = this.flingForce.angle();

        //Stretch based on predicted speed
        this.scale.set(1, lerp(0.65, 1, Math.min(Math.max(0, 1 - this.flingForce.lengthSq() * 0.00001), 1)));  
    }

    /**
     * Updates the aiming indicator for this frame
     * @returns {boolean} TRUE if the fling is invalid
     */
    updateAimingIndicator()
    {
        //Track to the player
        this.aimingIndicator.position = this.position;

        //Scale the fling force to be more visible on screen
        const aimingVector = this.flingForce.clone().multiplyScalar(0.7);

        for(let i = 0; i < this.aimingIndicatorList.length; i++)
        {
            const indicator = this.aimingIndicatorList[i];

            //Calculate the lerp amount for this indicator
            const lerpAmount = INV_TOTAL_AIM_INDICATORS * (i + 1);

            //A proportional linear interpolation between the player and the fling force
            const lerpPosition = lerp2D(Victor(0, 0), aimingVector, lerpAmount);
            indicator.position.set(lerpPosition.x, lerpPosition.y);

            //Scale the indicator based on the inverted lerp and also scale based on the fling force magnitude
            indicator.scale.set(
                lerp(AIM_INDICATOR_SCALE_RANGE.x, AIM_INDICATOR_SCALE_RANGE.y, 1 - lerpAmount) *
                Math.min(1, aimingVector.magnitude() * 0.005));

            //Lerp the alpha as well
            indicator.alpha = lerp(0.3, 0.9, 1 - lerpAmount);

            //Tint color as normal
            indicator.tint = 0xffff00;
        }

        //Make sure the aiming number isn't too small and is opaque
        this.aimingNumber.scale.set(Math.max(0.5, this.aimingNumber.scale.x * 1.75));
        this.aimingNumber.alpha = 1;

        //If the fling force is too small, tint the number red
        this.aimingNumber.tint = 0xffffff;
        const isInvalid = this.flingForce.lengthSq() < FLING_FORCE_MIN || this.flings == 0;
        if(isInvalid) this.styleInvalidFling();

        //Return if the fling is invalid
        return isInvalid;
    }

    //#endregion

    //#region Alive and Idle

    /**
     * Tasks to be run every frame when the player is alive
     */
    whenAlive()
    {
        //Check collision with wave
        if(WAVE.isColliding(this.vectorPosition))
        {
            this.onDeath();
            return;//Don't bounce if already dead
        }

        //Check collisions with obstacles
        this.checkCollisions();
    }

    /**
     * Checks collisions with obstacles (orbs and spikes) and reacts accordingly
     */
    checkCollisions()
    {
        //Orbs
        for(const orb of ORBS)
        {
            if(this.isColliding(orb))
            {
                //Get a lil boost
                this.velocity = Victor(-this.velocity.x, -Math.abs(this.velocity.y) * ORB_BOOST_MULTIPLIER);

                //Increase flings
                this.setFlingAmount(this.flings + 1);

                //Drestroy orb
                orb.destroy(CAMERA.nextCameraBound);
            }
        }

        //Spikes
        for(const spike of SPIKES)
        {
            if(this.isColliding(spike))
            {
                //Knockback
                this.velocity = this.velocity.clone().multiplyScalar(-0.5);

                //Increase flings
                this.setFlingAmount(this.flings - 1);

                //Drestroy orb
                spike.destroy(CAMERA.nextCameraBound);
            }
        }
    }

    /**
     * Flings the player, fsm transition
     */
    onFling()
    {
        //This could happen if you click outside of the canvas since I want it to be seamless for the player
        if(this.playerState !== PLAYER_STATE.Aiming) return;

        //Hide indicator and reset time
        this.exitAiming();

        //Change state
        this.playerState = PLAYER_STATE.Idle;

        //If the mouse is within the player's collider or no flings left, don't fling (cancel)
        if(this.flingForce.lengthSq() < FLING_FORCE_MIN || this.flings == 0)
        {
            playSound(SFX_ID.Spike);
            return;
        }

        this.setFlingAmount(this.flings - 1);

        //Play sound
        playSound(SFX_ID.Fling);

        //Fling the player
        this.velocity = this.flingForce.clone().multiplyScalar(5);
    }

    /**
     * Transitions out of aiming
     */
    exitAiming()
    {
        //Hide aiming indicators
        this.aimingIndicator.visible = false;

        //Time goes back to normal, also make it go back quicker so it feels more responsive
        currentGameSpeed = 0.5;
        targetGameSpeed = 1;
    }

    //#endregion

    //#region Death

    /**
     * Kills the player, fsm transition
     */
    onDeath()
    {
        //Change state
        this.playerState = PLAYER_STATE.Dead;

        //Transition out of aiming
        this.exitAiming();

        //Stop horizontal velocity
        this.velocity.x = 0;

        //Play sound
        playSound(SFX_ID.Death);

        //Record death height
        recordDeathHeight(Math.ceil(this.vectorPosition.y * -0.1) + 100);
    }

    /**
     * Tasks to be run every frame when the player is dead
     */
    whenDead()
    {
        //Check if whole screen is white
        if(WAVE.y < CAMERA.boundingRectangle.top)
        {
            transitionToMenu();
        }
    }

    //#endregion

    //#region Tutorial

    /**
     * Update tasks for tutorial (only at beginning of each game)
     */
    whenTutorial()
    {
        //Completely stop time
        targetGameSpeed = 0;
        currentGameSpeed = 0;
    }

    //#endregion

    //#endregion
}

//#endregion

/**
 * A camera which can do basic panning and zooming
 */
class Camera
{
    /**
     * Creates a new Camera
     */
    constructor(xBounds)
    {
        /**@type {Victor}*/this.position = Victor(0, 0);
        /**@type {number}*/this.zoom = 1;
        
        /**
         * The transformation matrix used to apply the camera to the stage
         * @type {PIXI.Matrix}
         */this.matrix = new PIXI.Matrix();

        /**
         * The rectangle that bounds the camera in world space. Computed every update cycle
         * @type {PIXI.Rectangle}
         */
        this.boundingRectangle = new PIXI.Rectangle(0, 0, 0, 0);

        /**
         * The camera bound next frame up to be computed
         * @type {PIXI.Rectangle}
         */
        this.nextCameraBound = new PIXI.Rectangle(0, 0, 0, 0);

        /**
         * The bounds for the camera to stay within
         * @type {Victor}
         */
        this.xBounds = xBounds;
    }

    /**
     * Changes the position of the camera
     * @param {Victor} amount the amount to pan by
     */
    panBy = amount => this.position.add(amount);

    /**
     * Changes the scale of the camera
     * @param {number} amount The amount to zoom by
     */
    zoomBy = amount => this.zoom += amount;

    /**
     * Zooms to the specified point using the specified easing factor
     * (it will ease out exponentially). Easing factor should usually be between
     * 0 and 1 unless you want weird movement
     * @param {Victor} targetPosition Position to try to ease to
     * @param {number} targetZoom The zoom to try to ease to
     * @param {number} easingFactor The factor to ease by (for example 0.1 would
     * move and zoom by 1 tenth of the distance each time it is called)
     */
    easeTo(targetPosition, targetZoom, easingFactor)
    {
        this.position = lerp2D(this.position, targetPosition, easingFactor);
        // this.panBy(targetPosition.clone().subtract(this.position).multiplyScalar(easingFactor));
        this.zoom = lerp(this.zoom, targetZoom, easingFactor);
        // this.zoomBy((targetZoom - this.zoom) * easingFactor);
    }

    /**
     * Updates the camera matrix and applies it to the scene
     */
    update()
    {
        //Compute the matrix and bounding rectangle
        this.computeMatrix();

        //Clamp camera within bounds. If clamped, recompute the matrix bounding rectangle
        const overlapLeft = this.boundingRectangle.left - this.xBounds.x;
        const overlapRight = this.boundingRectangle.right - this.xBounds.y;
        //Prefers left, but if both are overlapping, each frame it will basically oscialte between the two
        //since it will be pushed out of the one which means it won't trigger that one but will the other
        //I am not handling this since it should never actually occur in the game
        if(overlapLeft < 0)
        {
            this.position.x -= overlapLeft;
            this.computeMatrix();
        }
        else if(overlapRight > 0)
        {
            this.position.x -= overlapRight;
            this.computeMatrix();
        }

        //Apply the matrix
        STAGE.transform.setFromMatrix(this.matrix);
    }

    /**
     * Returns the specified position in world space (relative to this camera)
     * @param {Victor} canvasPosition The position relative to the canvas
     * @returns {Victor} The position relative to the world
     */
    canvasToWorld = canvasPosition => toVector(this.matrix.applyInverse(canvasPosition.clone()));

    /**
     * Computes the camera's view bounds in world space and updates the property
     */
    computeBoundingRectangle()
    {
        const topLeft = this.canvasToWorld(Victor(0, 0));
        const bottomRight = this.canvasToWorld(Victor(APP_SIZE.x, APP_SIZE.y));
        this.boundingRectangle = new PIXI.Rectangle(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);

        //The next "frame" to respawn obstacles in
        this.nextCameraBound = CAMERA.boundingRectangle.clone();
        this.nextCameraBound.y -= this.nextCameraBound.height;
    }

    /**
     * Computes the matrix to be applied to the stage setting the matrix
     * and bounding rectangle properties (it computes the bounding rectangle)
     */
    computeMatrix()
    {
        //Create the matrix
        this.matrix.identity()
            .translate(-this.position.x, -this.position.y)
            .scale(this.zoom, this.zoom)
            .translate(APP_SIZE.x*0.5, APP_SIZE.y*0.5);

        //Update the bounding rectangle
        this.computeBoundingRectangle();
    }
}

/**
 * @type {number} The speed of the wave
 */
const WAVE_SPEED = 200;

/**
 * The white thing that approaches from below
 */
class Wave extends PIXI.Graphics
{
    /**
     * Creates a new Wave
     */
    constructor()
    {
        super();

        //Preform any resetting
        this.reset();

        //Scale to width of app, height is 2 * app height
        super.scale.set(APP_SIZE.x, APP_SIZE.y * 2);

        //Rectangle is a single unit wide and high
        super.beginFill(0xffffff);
        super.drawRect(0, 0, 1, 1);
        super.endFill();

        /**
         * The collider of the wave
         * @type {PIXI.Rectangle}
         */
        this.bounds = new PIXI.Rectangle(this.x, this.y, super.scale.x, super.scale.y)
    }

    /**
     * Updates the wave
     */
    update()
    {
        //Move the wave
        this.position.y -= WAVE_SPEED * timeSpeed;

        //If the wave is too far below (when not aiming), move it up
        if(PLAYER.playerState !== PLAYER_STATE.Aiming)
            this.position.y = Math.min(this.position.y, CAMERA.boundingRectangle.bottom + 100)

        //Update the collider
        this.bounds.y = this.y;
    }

    /**
     * Returns whether the specified point is colliding with this wave
     * @param {Victor} point The point to check collisions with
     * @returns {boolean} TRUE if the point is colliding with this wave
     */
    isColliding(point)
    {
        return this.bounds.contains(point.x, point.y);
    }

    /**
     * Resets this wave
     */
    reset()
    {
        //Start below player
        super.position.set(0, CAMERA_POSITION_DEFAULT.y + 300);
    }
}

/**
 * The easing factor for menu item scaling
 */
const MENU_EASING_FACTOR = 0.25;

/**
 * Represents a clickable text UI button
 */
class MenuItem extends PIXI.Text
{
    /**
     * Creates a new menu item
     * @param {string} text The text label
     * @param {number} tint The color of the text
     * @param {number} baseScale The original scale of the menu item
     * @param {Function} onClick The function to call when the button is clicked
     */
    constructor(text, tint, baseScale, onClick)
    {
        super(text, BOLD_TEXT_STYLE);

        super.tint = tint;

        //Set the anchor to the center
        super.anchor.set(0.5);

        /**
         * The base scale of the menu item. Used as reference for scaling
         */
        this.baseScale = baseScale;
        super.scale.set(baseScale);

        /**
         * The scale to ease to for tweeining
         */
        this.targetScale = baseScale;

        //Add the mouse events
        super.interactive = true;
        super.buttonMode = true;

        //The action
        super.on("pointerup", () =>
        {
            onClick();
            playSound(SFX_ID.Select);
        });

        //Tweening and sfx
        super.on("pointerdown", () => this.targetScale = baseScale * 0.9);
        super.on("pointerover", () => this.interact(baseScale * 1.1, SFX_ID.Swipe));
        super.on("pointerout", () => this.targetScale = baseScale * 1);

        //Add to list
        MENU_ITEMS.push(this);
    }

    /**
     * Updates this menu item
     */
    update()
    {
        //Ease to target scale
        super.scale.set(lerp(super.scale.x, this.targetScale, MENU_EASING_FACTOR));
    }

    /**
     * The standard interaction with menu items
     * @param {number} targetScale The target scale to ease to
     * @param {number} sfxID The sound effect id to play
     */
    interact(targetScale, sfxID)
    {
        //Set target scale
        this.targetScale = targetScale;

        //Play sound
        playSound(sfxID);
    }
}

//#endregion

//#region Global Variables (not actually global scope, but like, global for all intents and purposes)

//#region DOM

/**
 * The container element for the game
 * @type {HTMLElement}
 */
let GAME_CONTAINER_ELEMENT;

//#endregion

//#region PIXI

/**
 * A vector containing the width and height of the app (canvas element)
 * @type {Victor}
 */
const APP_SIZE = Victor(500, 750);

/**
 * The pixi application
 * @type {PIXI.Application}
 */
const APP = new PIXI.Application({width: APP_SIZE.x, height: APP_SIZE.y});

/**
 * The position of the app on the page (client)
 * @type {Victor}
 */
let APP_CLIENT_POSITION;

/**
 * The center of the app on the page (client)
 * You know, maybe I don't actually need this lol
 * @type {Victor}
 */
let APP_CLIENT_CENTER;

/**
 * The stage for the game (outer most container)
 * @type {PIXI.Container}
 */
const STAGE = APP.stage;

//#endregion

//#region Camera

/**
 * The main camera for the game
 * @type {Camera}
 */
const CAMERA = new Camera(Victor(0, APP_SIZE.x));

/**
 * The default position for the camera
 * @type {Victor}
 */
const CAMERA_POSITION_DEFAULT = Victor(APP_SIZE.x * 0.5, 0);

/**
 * The default zoom for the camera
 * @type {number}
 */
const CAMERA_ZOOM_DEFAULT = 1;

/**
 * The zoom for the camera when aiming
 * @type {number}
 */
const CAMERA_ZOOM_AIMING = CAMERA_ZOOM_DEFAULT * 1.5;

/**
 * The factor to ease the camera by normally
 * @type {number}
 */
const CAMERA_EASING_FACTOR = 0.1;

/**
 * The factor to ease the camera by when aiming
 * @type {number}
 */
const CAMERA_AIMING_EASING_FACTOR = 0.05;

/**
 * The factor to ease the camera by when player speed is too fast
 * @type {number}
 */
const CAMERA_SPEEDING_EASING_FACTOR = 0.3;

//#endregion

//#region Math

/**
 * 90 degrees in radians. Straight up
 * @type {number}
 */
const PI_OVER_2 = Math.PI * 0.5;

/**
 * 360 degrees in radians. Full circle
 * @type {number}
 */
const TWO_PI = Math.PI * 2;

//#endregion

//#region Text and UI

/**
 * The style for bold text
 * @type {PIXI.TextStyle}
 */
let BOLD_TEXT_STYLE;

/**
 * The style for bold text
 * @type {PIXI.TextStyle}
 */
let LIGHT_TEXT_STYLE;

/**
 * The last height which the player died at
 * @type {number}
 */
let lastDeathHeight = 0;

/**
 * The highest height which the player died at
 * @type {number}
 */
let highestDeathHeight = 0;

/**
 * The label for the highest death height
 * @type {PIXI.Text}
 */
let HIGHEST_LABEL;

/**
 * The label for the most recent death height
 * @type {PIXI.Text}
 */
let LAST_HEIGHT_LABEL;

/**
 * Sets the last death height to this one and overwrites highest if it is higher
 * @param {number} newHeight The new death height
 */
const recordDeathHeight = newHeight =>
{
    lastDeathHeight = newHeight;
    if(newHeight > highestDeathHeight) saveHighestsDeath(newHeight);
}

/**
 * The prefix for local storage
 * @type {string}
 */
const LS_PREFIX = "jmj2097-chronoFling-";

/**
 * The local storage key for the highest death height
 */
const LS_HIGHEST_DEATH = LS_PREFIX + "highestDeath";

/**
 * Saves the highest death height to local storage
 * @param {number} height The height to save
 */
const saveHighestsDeath = height =>
{
    highestDeathHeight = height;
    localStorage.setItem(LS_HIGHEST_DEATH, highestDeathHeight.toString());
}

/**
 * Loads the highest death height from local storage
 */
const loadHighestDeath = () =>
{
    const saved = localStorage.getItem(LS_HIGHEST_DEATH);
    if(saved) highestDeathHeight = parseInt(saved);
}

//#endregion

//#endregion

//#region Managers

//#region Physics Manager

/**@type {number} The game speed without being proccessed by delta time */
let currentGameSpeed = 1;

/**@type {number} The game speed being targeted (eased to) */
let targetGameSpeed = 1;

/**@type {number} The amount time should be progressing (game speed * delta time)*/
let timeSpeed = 1;

/**@type {number} The amount of friction to be applied to physics objects */
const FRICTION = 0.9;

/**@type {Victor} The gravity to be applied to physics objects */
const GRAVITY = Victor(0, 100000);

/**@type {number} The amount of easing to apply to the time speed */
const TIME_EASING_FACTOR = 0.1;

/**
 * Updates time speed
 */
const updatePhysicsManager = () =>
{
    //Ease to the target game speed
    currentGameSpeed = lerp(currentGameSpeed, targetGameSpeed, TIME_EASING_FACTOR);
    //Compute the time speed, use elapsed SECONDS so convert from ms
    timeSpeed = currentGameSpeed * APP.ticker.elapsedMS * 0.001;
}

//#endregion

//#region Object Manager

/**@type {PhysicsObject[]} The list of all objects in the game */
const OBJECTS = [];

/**@type {Obstacle[]} The list of all obstacles in the game */
const OBSTACLES = [];

/**@type {Orb[]} The list of all orbs in the game */
const ORBS = [];

/**@type {Spike[]} The list of all spikes in the game */
const SPIKES = [];

/**@type {Player} The player object */
let PLAYER;

/**@type {Wave} The wave */
let WAVE;

/**
 * Generates the specified amount of objects, should only be called once
 * @param {number} orbAmount Amount of orbs to generate
 * @param {number} spikeAmount Amount of spikes to generate
 */
const initializeOjects = (orbAmount, spikeAmount) =>
{
    //Generate orbs
    for(let i = 0; i < orbAmount; i++) new Orb();

    //Generate spikes
    for(let i = 0; i < spikeAmount; i++) new Spike();

    //Initialize the player
    PLAYER = new Player();

    //Initialize the wave
    WAVE = new Wave();
}

/**
 * Resets physics objects in the game excluding the player
 * @param {PIXI.Rectangle} bounds The bounds to respawn the objects in
 */
const resetObjects = bounds =>
{
    //How much space the obstacles need to give the player initially
    const personalSpace = PLAYER.colliderRadius * 10;

    //Spawn all the orbs
    for(const obstacle of OBSTACLES)
    {
        //Make sure the obstacle isn't colliding with the player within a reasonable distance
        do
        {
            obstacle.respawn(bounds);
        }
        while(isColliding(obstacle.vectorPosition, obstacle.colliderRadius, PLAYER.vectorPosition, personalSpace))
    }
}

/**
 * Updates all physics objects
 */
const updateObjects = () =>
{
    //Update all objects
    for(const object of OBJECTS)
    {
        object.update();
    }

    //Update the wave
    WAVE.update();
}

//#endregion

//#region Input Manager

/**
 * The position of the mouse in client space (the entire website)
 * @type {Victor}
 */
let mouseClientPosition = Victor(0, 0);

/**
 * The position of the mouse in canvas space (the canvas object)
 * @type {Victor}
 */
let mouseCanvasPosition = Victor(0, 0);

/**
 * The position of the mouse in world space (takes into account the camera)
 * @type {Victor}
 */
let mouseWorldPosition = Victor(0, 0);

/**@type {boolean}*/
let mouseDown = false;

/**
 * The position of the mouse when it was last pressed in canvas space
 * @type {Victor}
 */
let mouseDownCanvasPosition = Victor(0, 0);

/**
 * The position of the mouse when it was last released in canvas space
 * @type {Victor}
 */
let mouseUpCanvasPosition = Victor(0, 0);

/**
 * Initializes input related tasks 
 */
const initializeInputManager = () =>
{
    //Update the mouse position on move (over anything)
    document.onpointermove = e =>
    {
        mouseClientPosition = Victor(e.clientX, e.clientY);
        mouseCanvasPosition = mouseClientPosition.clone().subtract(APP_CLIENT_POSITION);
    };

    //When mouse down (only over canvas)
    APP.view.onpointerdown = e =>
    {
        //Stop from dragging on text
        e.preventDefault();
        mouseDown = true;

        //Position when pressed
        mouseDownCanvasPosition = Victor(e.clientX, e.clientY).subtract(APP_CLIENT_POSITION);

        //Begin aiming
        PLAYER.onAim();
    };

    //When mouse up (over anything)
    document.onpointerup = e =>
    {
        //Stop from dragging on text
        e.preventDefault();
        mouseDown = false;

        //Position when pressed
        mouseUpCanvasPosition = Victor(e.clientX, e.clientY).subtract(APP_CLIENT_POSITION);

        //Fling the player
        PLAYER.onFling();
    };
}

/**
 * Updates input related tasks
 */
const updateInputManager = () =>
{
    //This needs to be updated every frame since the camera can move even when the mouse isn't
    mouseWorldPosition = CAMERA.canvasToWorld(mouseCanvasPosition);
}

//#endregion

//#region Scene Manager

/**
 * The scenes in the game
 * @type {PIXI.Container[]}
 */
const SCENES = [];

/**
 * An "enum" for the scene names
 */
const SCENE_ID = Object.freeze({ Menu: 0, Game: 1 });

/**
 * The current scene based off the SCENE_ID enum. Should not be set outside of scene manager
 * @type {number}
 * @readonly
 */
let currentScene = SCENE_ID.Menu;

/**
 * Initializes all scenes and adds them to the stage
 */
const initializeScenes = () =>
{
    //Create the scenes and set them invisible
    for(const sceneID in SCENE_ID)
    {
        const scene = new PIXI.Container();
        scene.visible = false;
        SCENES.push(scene);
        STAGE.addChild(scene);
    }
}

/**
 * Returns the scene from the specified scene id
 * @param {number} sceneID The scene number, integer, which should be
 * passed in from the SCENE_ID enum
 * @returns {PIXI.Container}
 */
const getScene = (sceneID) => SCENES[sceneID];

/**
 * Sets the specified scene visible and all others invisible
 * @param {number} sceneID The scene number, integer, which should be
 * passed in from the SCENE_ID enum
 */
const switchToScene = (sceneID) =>
{
    getScene(currentScene).visible = false;
    currentScene = sceneID;
    getScene(sceneID).visible = true;
}

/**
 * How high the transition should start when easing into the menu
 * @type {number}
 */
const MENU_TRANSITION_HEIGHT = -1000;

/**
 * Switches to menu and sets up the scene
 */
const transitionToMenu = () =>
{
    //Setup menu
    resetMenu();

    //Move camera up for transition
    CAMERA.position.y = CAMERA_POSITION_DEFAULT.y + MENU_TRANSITION_HEIGHT;

    //Switch scene
    switchToScene(SCENE_ID.Menu);
}

/**
 * Switches to game and sets up the scene
 */
const transitionToGame = () =>
{
    resetGame();
    switchToScene(SCENE_ID.Game);
}

//#endregion

//#region Audio Manager

/**
 * The volume of all audio
 * @type {number}
 */
const AUDIO_VOLUME = 0.2;

/**
 * The sound effects in the game
 * @type {Howl[]}
 */
const SFX = [];

/**
 * An "enum" for the sound effect names
 */
const SFX_ID = Object.freeze
({
    Select: 0,
    Swipe: 1,
    Back: 2,
    Aim: 3,
    Fling: 4,
    Orb: 5,
    Spike: 6,
    Death: 7
});

/**
 * Initializes all audio
 */
const loadAudio = () =>
{
    Howler.volume(AUDIO_VOLUME);

    //Initialize sound effects
    for(const soundName in SFX_ID)
    {
        importSfx(soundName);
    }

    //Initialize music (if there was any)
}

/**
 * The directory for all audio files
 * @type {string}
 */
const audioDirectory = "assets/audio/";

/**
 * The directory for all sound effects
 * @type {string}
 */
const sfxDirectory = audioDirectory + "sfx/";

/**
 * Imports the specified sfx
 * @param {string} soundName The file name excluding the extension
 */
const importSfx = soundName =>
{
    SFX[SFX_ID[soundName]] = new Howl({src: [sfxDirectory + soundName + ".wav"]});
}

/**
 * Plays the specified sound effect
 * @param {number} soundID The sound id from the SFX_ID enum
 */
const playSound = soundID => SFX[soundID].play();

//#endregion

//#region Menu Manager

/**
 * List of all menu items
 * @type {MenuItem[]}
 */
const MENU_ITEMS = [];

/**
 * Opens the specified url in a new tab
 * @param {string} url url to be opened
 */
const openWebpage = url => window.open(url, "_blank");

//#endregion

//#endregion

//#region Initialization and Mono Behaviors

/**
 * Initial method for loading into the DOM
 */
const init = () =>
{
    //The game container
    GAME_CONTAINER_ELEMENT = document.querySelector("#gameContainer");

    //Add the game panel to the dom
    GAME_CONTAINER_ELEMENT.appendChild(APP.view);

    //Set the position relative to the page
    const bounds = APP.view.getBoundingClientRect();
    APP_CLIENT_POSITION = Victor(bounds.x, bounds.y);

    //Set the client center
    APP_CLIENT_CENTER = APP_CLIENT_POSITION.clone().add(APP_SIZE.clone().multiplyScalar(0.5));

    //Load local storage
    loadHighestDeath();

    //Load any assets
    loadAssets();
}

/**
 * Load fonts first before anything, then initialize the game
 */
const loadFonts = () =>
{
    WebFont.load
    ({
        google:
        {
            families: ["Comfortaa"]
        },
        active: init
    });
}

window.onload = loadFonts;

/**
 * Loads all the assets for the game. Called after the DOM is loaded
 */
const loadAssets = async() =>
{
    //Create fonts
    BOLD_TEXT_STYLE = new PIXI.TextStyle
    ({
        fill: 0xffffff,
        fontSize: 50,
        fontFamily: "Comfortaa",
        fontWeight: "bold",
        align: "center",
        justify: "center"
    });

    LIGHT_TEXT_STYLE = new PIXI.TextStyle
    ({
        fill: 0xffffff,
        fontSize: 50,
        fontFamily: "Comfortaa",
        align: "center",
        justify: "center"
    });

    //Load audio
    loadAudio();

    //Start the game
    start();
}

/**
 * Called when all assets are loaded
 */
const start = () =>
{
    //Initialize the input manager
    initializeInputManager();

    //Initialize the scenes
    initializeScenes();
    initializeGameScene(getScene(SCENE_ID.Game));
    initializeMenu(getScene(SCENE_ID.Menu));
    switchToScene(SCENE_ID.Menu);

    //Add debug to the stage to be visible over everything
    STAGE.addChild(DEBUG);

    //Begin the game loop
    APP.ticker.add(update);
}

/**
 * The game loop
 */
const update = () =>
{
    //Scene fsm
    switch(currentScene)
    {
        case SCENE_ID.Menu:
            updateMenu();
            break;
        case SCENE_ID.Game:
            updateGame();
            break;
    }
    
    //Update the debugger AFTER objects are updated so there is no lag in positioning
    DEBUG.update();
}

//#endregion

//#region Menu Scene

/**
 * Initialize the menu scene
 * @param {PIXI.Container} menuScene The scene to initialize the menu into
 */
const initializeMenu = menuScene =>
{
    //Add menu elements

    //Title
    const title = new PIXI.Text("Chrono-Fling", LIGHT_TEXT_STYLE);
    title.position.set(CAMERA_POSITION_DEFAULT.x, CAMERA_POSITION_DEFAULT.y - APP_SIZE.y * 0.35);
    title.tint = 0x000000;
    title.anchor.set(0.5);
    title.scale.set(1.25);
    menuScene.addChild(title);

    //Play
    const playButton = new MenuItem("Play", 0x000000, 1, transitionToGame);
    playButton.position.x = CAMERA_POSITION_DEFAULT.x;
    menuScene.addChild(playButton);

    //Documentation
    const docButton = new MenuItem("Doc", 0x000000, 0.6, () => openWebpage("doc.html"));
    docButton.position.set(CAMERA_POSITION_DEFAULT.x - APP_SIZE.x * 0.4,
        CAMERA_POSITION_DEFAULT.y + APP_SIZE.y * 0.45);
    docButton.tint = 0x000fff;
    menuScene.addChild(docButton);

    //Repo
    const repoButton = new MenuItem("Repo", 0x000000, 0.6, () => openWebpage("https://github.com/jjanrb/chrono-fling"));
    repoButton.position.set(CAMERA_POSITION_DEFAULT.x + APP_SIZE.x * 0.4,
        CAMERA_POSITION_DEFAULT.y + APP_SIZE.y * 0.45);
        repoButton.tint = 0x000fff;
    menuScene.addChild(repoButton);

    //Proposal
    const proposalButton = new MenuItem("Proposal", 0x000000, 0.6, () => openWebpage("proposal.html"));
    proposalButton.position.set(CAMERA_POSITION_DEFAULT.x, CAMERA_POSITION_DEFAULT.y + APP_SIZE.y * 0.45);
    proposalButton.tint = 0x000fff;
    menuScene.addChild(proposalButton);
    
    //Author
    const authorButton = new MenuItem("By Jonathan Jan", 0x000000, 0.4, () => openWebpage("https://jjanrb.github.io/portfolio/"));
    authorButton.position.set(CAMERA_POSITION_DEFAULT.x,
        CAMERA_POSITION_DEFAULT.y - APP_SIZE.y * 0.25);
        authorButton.tint = 0x000fff;
    menuScene.addChild(authorButton);

    //Highest death
    HIGHEST_LABEL = new PIXI.Text(" ", LIGHT_TEXT_STYLE);
    HIGHEST_LABEL.position.set(CAMERA_POSITION_DEFAULT.x, CAMERA_POSITION_DEFAULT.y + APP_SIZE.y * 0.25);
    HIGHEST_LABEL.tint = 0x00bb00;
    HIGHEST_LABEL.anchor.set(0.5);
    HIGHEST_LABEL.scale.set(0.5);
    menuScene.addChild(HIGHEST_LABEL);

    //Recent death
    LAST_HEIGHT_LABEL = new PIXI.Text(" ", LIGHT_TEXT_STYLE);
    LAST_HEIGHT_LABEL.position.set(CAMERA_POSITION_DEFAULT.x, CAMERA_POSITION_DEFAULT.y + APP_SIZE.y * 0.15);
    LAST_HEIGHT_LABEL.tint = 0xff0000;
    LAST_HEIGHT_LABEL.anchor.set(0.5);
    LAST_HEIGHT_LABEL.scale.set(0.5);
    menuScene.addChild(LAST_HEIGHT_LABEL);

    //Setup menu
    resetMenu();
}

/**
 * Updates the menu scene
 */
const updateMenu = () =>
{
    //Ease to menu
    CAMERA.easeTo(CAMERA_POSITION_DEFAULT, CAMERA_ZOOM_DEFAULT, CAMERA_AIMING_EASING_FACTOR);

    //Update menu items
    for(const item of MENU_ITEMS) item.update();
    
    //Update camera
    CAMERA.update();
    updateInputManager();
}

/**
 * Resets everything in the menu to starting values
 */
const resetMenu = () =>
{
    //Set background
    APP.renderer.backgroundColor = 0xffffff;

    //Transition camera
    CAMERA.zoom = CAMERA_ZOOM_DEFAULT;
    CAMERA.position = CAMERA_POSITION_DEFAULT.clone();

    //Highest death
    if(highestDeathHeight > 0)
    {
        HIGHEST_LABEL.text = `Farthest reached: ${highestDeathHeight}m`;
    }

    //Recent death
    if(lastDeathHeight > 0)
    {
        LAST_HEIGHT_LABEL.text = `You just reached reached: ${lastDeathHeight}m`;
    }
}

//#endregion

//#region Game Scene

/**
 * Initializes the game into the specified scene
 * @param {PIXI.Container} gameScene The scene to initialize the game into
 */
const initializeGameScene = gameScene =>
{
    //Initialize the objects
    initializeOjects(10, 7);

    //Add all the objects to the scene
    for(const object of OBJECTS)
    {
        gameScene.addChild(object);
    }

    //Add wave to the scene
    gameScene.addChild(WAVE);

    //Add tutorial text
    const title = new PIXI.Text("Drag anywhere and\nrelease to fling", LIGHT_TEXT_STYLE);
    title.position.set(CAMERA_POSITION_DEFAULT.x, CAMERA_POSITION_DEFAULT.y);
    title.tint = 0xffffff;
    title.anchor.set(0.5);
    title.scale.set(0.5);
    gameScene.addChild(title);
}

/**
 * Updates the game scene
 */
const updateGame = () =>
{
    //Follow player when not aiming, speed up camera if player is going too fast
    let easeFactor = CAMERA_EASING_FACTOR;
    if(PLAYER.velocity.lengthSq() > 6000000) easeFactor  = CAMERA_SPEEDING_EASING_FACTOR;
    CAMERA.easeTo(PLAYER.vectorPosition, CAMERA_ZOOM_DEFAULT, easeFactor);
    
    //Update camera
    CAMERA.update();
    updateInputManager();

    //Update physics manager
    updatePhysicsManager();

    //Update all physics objects
    updateObjects();
}

/**
 * Resets everything in the game to starting values
 */
const resetGame = () =>
{
    //Set background
    APP.renderer.backgroundColor = 0x000000;

    //Reset player
    PLAYER.reset();

    //Reset camera
    CAMERA.zoom = CAMERA_ZOOM_DEFAULT;
    CAMERA.position = CAMERA_POSITION_DEFAULT.clone();

    //Compute the matrix and bounding rectangle
    CAMERA.computeMatrix();

    //Reset other physics objects
    resetObjects(CAMERA.boundingRectangle);

    //Reset the wave
    WAVE.reset();
}

//#endregion

//#region Utility

/**
 * Returns a Victor of the specified point or object with x and y properties
 * @param {any} point Any object that holds x and y properties
 * @returns {Victor} A vector with the same x and y values as the point
 */
const toVector = (point) => Victor(point.x, point.y);

/**
 * Generates a random number from 0 to the specified maximum
 * @param {number} max Max inclusive
 * @returns {number} A random number from 0 to the specified max
 */
const random = max => Math.random() * max;

/**
 * Generates a random number within the specified range
 * @param {number} min Min inclusive
 * @param {number} max Max inclusive
 * @returns {number} A random number within the specified range
 */
const randomRange = (min, max) => random(max - min) + min;


/**
 * Generates a random vector within the specified bounds
 * @param {PIXI.Rectangle} bounds The bounds within which the vector should be generated
 * @returns {Victor} The randomly generated vector
 */
const randomRange2D = bounds =>
    Victor(randomRange(bounds.x, bounds.right), randomRange(bounds.y, bounds.bottom));

/**
 * Linearly interpolates between two numbers.
 * If you set something to the lerp of itself, target, and easing, it is an easing function too
 * @param {number} min The lower bound
 * @param {number} max The upper bound
 * @param {number} progress How far along the lerp it is (0-1) or easing factor
 * @returns {number} The lerped vector
 */
const lerp = (min, max, progress) => min + (max - min) * progress;

/**
 * Linearly interpolates between two vectors
 * @param {Victor} min The lower bound of the lerp
 * @param {Victor} max The upper bound of the lerp
 * @param {number} progress How far along the lerp it is (0-1) or easing factor
 * @returns {Victor} The lerped vector
 */
const lerp2D = (min, max, progress) => min.clone().add(max.clone().subtract(min).multiplyScalar(progress));

/**
 * Checks if the specified decomposed circles are colliding
 * @param {Victor} p1 The position of the first circle
 * @param {number} r1 The radius of the first circle
 * @param {Victor} p2 The position of the second circle
 * @param {number} r2 The radius of the second circle
 * @returns {boolean} TRUE if the circles are colliding
 */
const isColliding = (p1, r1, p2, r2) =>
{
    //Use distance squared to avoid the square root
    const radiusTotal = r1 + r2;
    return p1.distanceSq(p2) < radiusTotal * radiusTotal;
}

/**
 * Returns whether the specified circle is colliding with the specified point
 * @param {Victor} position The position of the circle
 * @param {number} radius The radius of the circle
 * @param {Victor} targetPoint The point to check against
 * @returns {boolean} TRUE if the circle is colliding with the point
 */
const isCircleCollidingWithPoint = (position, radius, targetPoint) =>
{
    return position.distanceSq(targetPoint) < radius * radius;
}

//#endregion
